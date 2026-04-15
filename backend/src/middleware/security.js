import { auditLogsRepository } from "../repositories/auditLogsRepository.js";

const unauthorized = (res, message = "Authentication required.") => res.status(401).json({ message });
const forbidden = (res, message = "You do not have permission to perform this action.") => res.status(403).json({ message });

export const requireActiveAccount = (req, res, next) => {
  const user = req.user;

  if (!user) {
    return unauthorized(res);
  }

  if (user.status !== "active" || user.accountRestrictions?.frozen) {
    return forbidden(res, "Your account is restricted pending compliance review.");
  }

  return next();
};

export const requireConsents = (req, res, next) => {
  if (!req.user?.termsAcceptedAt || !req.user?.privacyAcceptedAt) {
    return forbidden(res, "Please accept the latest terms and privacy policy to continue.");
  }

  return next();
};

export const requireVerifiedContact = (req, res, next) => {
  if (!req.user?.emailVerified) {
    return forbidden(res, "Verify your email before accessing this feature.");
  }

  if (!req.user?.phoneVerified) {
    return forbidden(res, "Verify your phone before accessing this feature.");
  }

  return next();
};

export const requireKycApproved = (req, res, next) => {
  if (req.user?.kycStatus !== "approved") {
    return forbidden(res, "KYC approval is required for this action.");
  }

  return next();
};

export const requireTwoFactorForWithdrawal = async (req, res, next) => {
  if (!req.user?.twoFactorEnabled) {
    return next();
  }

  const code = req.validated?.body?.twoFactorCode || req.body?.twoFactorCode;

  if (!code) {
    return forbidden(res, "Two-factor verification is required for withdrawals.");
  }

  if (code !== req.user.twoFactorBackupCode) {
    await auditLogsRepository.create({
      action: "withdrawal_2fa_failed",
      actorId: req.user.id,
      actorRole: req.user.role,
      resourceType: "withdrawal",
      resourceId: "pending",
      metadata: {
        reason: "invalid_2fa_code",
      },
    });

    return forbidden(res, "Two-factor verification failed.");
  }

  return next();
};

export const secureErrorHandler = (error, req, res, _next) => {
  const statusCandidate = Number.isInteger(error?.statusCode)
    ? error.statusCode
    : Number.isInteger(error?.status)
      ? error.status
      : 500;
  const status = statusCandidate >= 400 && statusCandidate <= 599 ? statusCandidate : 500;
  const candidateMessage = typeof error?.message === "string" ? error.message.trim() : "";
  const message = status >= 500 ? "Unexpected server error. Please try again." : candidateMessage || "Request could not be completed.";

  if (status >= 500) {
    console.error("Unhandled request error", {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      status,
      error,
    });
  }

  return res.status(status).json({
    message,
    requestId: req.requestId,
  });
};
