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
  return res.status(statusCode).json({ message });
};

export const getKycOptions = (req, res) => {
  const { countryCode } = req.validated.params;
  return res.json({ options: listJurisdictionOptions(countryCode) });
};

export const sendEmailOtp = async (req, res) => {
  try {
    const result = await sendContactVerificationOtp({
      user: req.user,
      channel: "email",
    });

    return res.json({
      message: "Email verification OTP sent.",
      ...result,
    });
  } catch (error) {
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
    return sendHandledError(res, error, "Unable to verify email OTP.");
  }
};

export const sendMobileOtp = async (req, res) => {
  try {
    const result = await sendContactVerificationOtp({
      user: req.user,
      channel: "phone",
    });

    return res.json({
      message: "Mobile verification OTP sent.",
      ...result,
    });
  } catch (error) {
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
