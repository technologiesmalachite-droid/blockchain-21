import {
  getKycDocumentFile,
  getKycStatusForUser,
  listJurisdictionOptions,
  sendContactVerificationOtp,
  softDeleteKycDocument,
  submitKycApplication,
  submitKycProfile,
  uploadKycDocuments,
  verifyContactOtp,
} from "../services/kycService.js";

const sendHandledError = (res, error, fallbackMessage) => {
  const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 400;
  const message = typeof error?.message === "string" && error.message.trim() ? error.message : fallbackMessage;
  const code = typeof error?.code === "string" ? error.code : undefined;
  return res.status(statusCode).json(code ? { message, code } : { message });
};

const mapOtpSendError = (error, channel) => {
  const code = typeof error?.code === "string" ? error.code : "";
  const isEmail = channel === "email";
  const label = isEmail ? "Email" : "Mobile";

  if (code === "KYC_OTP_DESTINATION_MISSING") {
    return { statusCode: 400, message: `${label} destination is missing on this account.`, code };
  }

  if (code === "KYC_MOBILE_MISSING") {
    return { statusCode: 400, message: "Verify your phone number to continue KYC.", code };
  }

  if (code === "KYC_MOBILE_INVALID") {
    return { statusCode: 400, message: "Enter a valid mobile number to continue KYC.", code };
  }

  if (code === "KYC_EMAIL_ALREADY_VERIFIED" || code === "KYC_MOBILE_ALREADY_VERIFIED") {
    return { statusCode: 409, message: `${label} is already verified.`, code };
  }

  if (
    code === "KYC_OTP_RETRY_TOO_SOON" ||
    code === "KYC_OTP_MAX_RESENDS_REACHED" ||
    code === "KYC_OTP_ACTIVE_CHALLENGE_EXISTS"
  ) {
    return {
      statusCode: 429,
      message: typeof error?.message === "string" ? error.message : "OTP already active. Please retry shortly.",
      code,
    };
  }

  if (
    code === "CONFIG_EMAIL_OTP_PROVIDER_MISSING" ||
    code === "EMAIL_OTP_PROVIDER_AUTH_FAILED" ||
    code === "EMAIL_OTP_PROVIDER_NETWORK_FAILED" ||
    code === "EMAIL_OTP_DELIVERY_FAILED"
  ) {
    return {
      statusCode: 503,
      message: "Email provider unavailable. Please try again shortly.",
      code,
    };
  }

  if (code === "CONFIG_EMAIL_OTP_SENDER_INVALID" || code === "EMAIL_OTP_PROVIDER_RESTRICTED_TEST_SENDER") {
    return {
      statusCode: 500,
      message: "Email sender configuration is invalid. Please contact support.",
      code,
    };
  }

  if (code === "KYC_OTP_DATABASE_UNAVAILABLE") {
    return {
      statusCode: 503,
      message: "Verification service is temporarily unavailable. Please try again shortly.",
      code,
    };
  }

  return null;
};

const mapOtpVerifyError = (error) => {
  const code = typeof error?.code === "string" ? error.code : "";

  if (code === "KYC_OTP_NOT_FOUND" || code === "KYC_OTP_EXPIRED" || code === "KYC_OTP_INCORRECT") {
    return {
      statusCode: 400,
      message: typeof error?.message === "string" ? error.message : "OTP is invalid or expired.",
      code,
    };
  }

  if (code === "KYC_OTP_MAX_ATTEMPTS_REACHED") {
    return {
      statusCode: 429,
      message: "Maximum verification attempts reached. Request a new OTP.",
      code,
    };
  }

  if (code === "KYC_OTP_DATABASE_UNAVAILABLE") {
    return {
      statusCode: 503,
      message: "Verification service is temporarily unavailable. Please try again shortly.",
      code,
    };
  }

  return null;
};

export const getKycOptions = (req, res) => {
  const { countryCode } = req.validated.params;
  return res.json({ options: listJurisdictionOptions(countryCode) });
};

export const sendEmailOtp = async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ message: "Session is invalid. Please sign in again." });
  }

  const sessionEmail = String(req.session?.email || "").trim().toLowerCase();
  const userEmail = String(req.user.email || "").trim().toLowerCase();
  const email = userEmail || sessionEmail;

  if (!email) {
    return res.status(401).json({ message: "Session is invalid. Please sign in again." });
  }

  try {
    const result = await sendContactVerificationOtp({
      user: {
        ...req.user,
        email,
      },
      channel: "email",
      requestId: req.requestId || null,
    });

    return res.json({
      message: "Email verification OTP sent.",
      ...result,
    });
  } catch (error) {
    const mapped = mapOtpSendError(error, "email");
    if (mapped) {
      return res.status(mapped.statusCode).json({ message: mapped.message, code: mapped.code });
    }
    return sendHandledError(res, error, "Unable to send email OTP right now.");
  }
};

export const verifyEmailOtp = async (req, res) => {
  try {
    const updatedUser = await verifyContactOtp({
      user: req.user,
      channel: "email",
      code: req.validated.body.code,
    });

    return res.json({
      message: "Email verification completed.",
      status: updatedUser.kycStatus,
    });
  } catch (error) {
    const mapped = mapOtpVerifyError(error);
    if (mapped) {
      return res.status(mapped.statusCode).json({ message: mapped.message, code: mapped.code });
    }
    return sendHandledError(res, error, "Unable to verify email OTP.");
  }
};

export const sendMobileOtp = async (req, res) => {
  try {
    const mobile = typeof req.body?.mobile === "string" ? req.body.mobile : "";
    const result = await sendContactVerificationOtp({
      user: req.user,
      channel: "phone",
      requestId: req.requestId || null,
      destinationOverride: mobile,
    });

    return res.json({
      message: "Mobile verification OTP sent.",
      ...result,
    });
  } catch (error) {
    const mapped = mapOtpSendError(error, "phone");
    if (mapped) {
      return res.status(mapped.statusCode).json({ message: mapped.message, code: mapped.code });
    }
    return sendHandledError(res, error, "Unable to send mobile OTP right now.");
  }
};

export const verifyMobileOtp = async (req, res) => {
  try {
    const updatedUser = await verifyContactOtp({
      user: req.user,
      channel: "phone",
      code: req.validated.body.code,
    });

    return res.json({
      message: "Mobile verification completed.",
      status: updatedUser.kycStatus,
    });
  } catch (error) {
    const mapped = mapOtpVerifyError(error);
    if (mapped) {
      return res.status(mapped.statusCode).json({ message: mapped.message, code: mapped.code });
    }
    return sendHandledError(res, error, "Unable to verify mobile OTP.");
  }
};

export const submitKycProfileController = async (req, res) => {
  try {
    if (!req.validated.body.consentAccepted) {
      return res.status(400).json({ message: "Consent is required before submission." });
    }

    const result = await submitKycProfile({
      user: req.user,
      payload: req.validated.body,
    });

    return res.status(201).json({
      message: "Verification profile saved.",
      submission: result.submission,
      panVerification: result.panVerification,
    });
  } catch (error) {
    return sendHandledError(res, error, "Unable to submit KYC profile.");
  }
};

export const submitKycDocumentsController = async (req, res) => {
  try {
    if (!req.body?.consentAccepted || `${req.body.consentAccepted}` !== "true") {
      return res.status(400).json({ message: "Consent is required before document upload." });
    }

    const result = await uploadKycDocuments({
      user: req.user,
      payload: req.body,
      files: req.files,
    });

    return res.status(201).json({
      message: "Documents uploaded successfully and routed for review.",
      ...result,
    });
  } catch (error) {
    return sendHandledError(res, error, "Unable to upload KYC documents.");
  }
};

export const submitKyc = async (req, res) => {
  try {
    const result = await submitKycApplication({
      user: req.user,
      payload: req.validated.body,
    });

    return res.status(201).json({
      submission: result.submission,
      panVerification: result.panVerification,
      message: "KYC submitted and queued for review.",
    });
  } catch (error) {
    return sendHandledError(res, error, "Unable to submit KYC data.");
  }
};

export const getKycStatus = async (req, res) => res.json(await getKycStatusForUser(req.user));

export const getKycDocument = async (req, res) => {
  try {
    const { documentId } = req.validated.params;
    const filePayload = await getKycDocumentFile({
      actor: req.user,
      documentId,
    });

    res.setHeader("Content-Type", filePayload.mimeType);
    res.setHeader("Content-Disposition", `inline; filename=\"${filePayload.fileName}\"`);
    return res.send(filePayload.buffer);
  } catch (error) {
    return sendHandledError(res, error, "Unable to access KYC document.");
  }
};

export const deleteKycDocument = async (req, res) => {
  try {
    const { documentId } = req.validated.params;
    const result = await softDeleteKycDocument({
      actor: req.user,
      documentId,
      reason: "deleted_by_user",
    });

    return res.json({
      message: "Document removed and marked for policy-based purge.",
      document: result,
    });
  } catch (error) {
    return sendHandledError(res, error, "Unable to delete KYC document.");
  }
};
