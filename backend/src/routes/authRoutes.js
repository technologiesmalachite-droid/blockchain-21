import { Router } from "express";
import {
  changePassword,
  disableTwoFactor,
  emailOtpSend,
  emailOtpVerify,
  firebaseSession,
  forgotPassword,
  getSessionHistory,
  login,
  logout,
  refresh,
  register,
  regenerateTwoFactorBackupCodes,
  resetPassword,
  revokeOtherSessions,
  revokeSession,
  sendVerification,
  setupTwoFactor,
  verifyEnableTwoFactor,
  verifyTwoFactorLogin,
  verifyContact,
} from "../controllers/authController.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  changePasswordSchema,
  emailOtpSendSchema,
  emailOtpVerifySchema,
  firebaseSessionSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  revokeOtherSessionsSchema,
  revokeSessionSchema,
  sendVerificationSchema,
  twoFactorBackupCodesRegenerateSchema,
  twoFactorDisableSchema,
  twoFactorLoginVerifySchema,
  twoFactorSetupSchema,
  twoFactorVerifyEnableSchema,
  verifyContactSchema,
} from "../models/schemas.js";
import {
  authAttemptLimiter,
  authEmailOtpSendLimiter,
  authEmailOtpVerifyLimiter,
  twoFactorActionLimiter,
  twoFactorVerifyLimiter,
} from "../middleware/rateLimits.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();
const basicEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ensureEmailOtpSendInput = (req, res, next) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";

  if (process.env.NODE_ENV !== "production") {
    console.log("otp_send_input_email:", email);
  }

  if (!email) {
    return res.status(400).json({
      error: "Email is required",
      message: "Email is required",
    });
  }

  if (!basicEmailPattern.test(email)) {
    return res.status(400).json({
      error: "Valid email is required",
      message: "Valid email is required",
    });
  }

  return next();
};

router.post("/register", authAttemptLimiter, validate(registerSchema), asyncHandler(register));
router.post("/login", authAttemptLimiter, validate(loginSchema), asyncHandler(login));
router.post("/email-otp/send", authEmailOtpSendLimiter, ensureEmailOtpSendInput, validate(emailOtpSendSchema), asyncHandler(emailOtpSend));
router.post("/email-otp/verify", authEmailOtpVerifyLimiter, validate(emailOtpVerifySchema), asyncHandler(emailOtpVerify));
router.post("/forgot-password", authAttemptLimiter, validate(forgotPasswordSchema), asyncHandler(forgotPassword));
router.post("/reset-password", authAttemptLimiter, validate(resetPasswordSchema), asyncHandler(resetPassword));
router.post("/2fa/login-verify", twoFactorVerifyLimiter, validate(twoFactorLoginVerifySchema), asyncHandler(verifyTwoFactorLogin));
router.post("/firebase/session", authAttemptLimiter, validate(firebaseSessionSchema), asyncHandler(firebaseSession));
router.post("/logout", asyncHandler(logout));
router.post("/refresh", authAttemptLimiter, asyncHandler(refresh));
router.post("/change-password", requireAuth, authAttemptLimiter, validate(changePasswordSchema), asyncHandler(changePassword));

router.get("/sessions", requireAuth, asyncHandler(getSessionHistory));
router.post("/sessions/revoke", requireAuth, validate(revokeSessionSchema), asyncHandler(revokeSession));
router.post("/sessions/revoke-others", requireAuth, validate(revokeOtherSessionsSchema), asyncHandler(revokeOtherSessions));
router.post("/verification/send", requireAuth, authAttemptLimiter, validate(sendVerificationSchema), asyncHandler(sendVerification));
router.post("/verification/confirm", requireAuth, authAttemptLimiter, validate(verifyContactSchema), asyncHandler(verifyContact));
router.post("/2fa/setup", requireAuth, twoFactorActionLimiter, validate(twoFactorSetupSchema), asyncHandler(setupTwoFactor));
router.post("/2fa/verify-enable", requireAuth, twoFactorVerifyLimiter, validate(twoFactorVerifyEnableSchema), asyncHandler(verifyEnableTwoFactor));
router.post("/2fa/disable", requireAuth, twoFactorVerifyLimiter, validate(twoFactorDisableSchema), asyncHandler(disableTwoFactor));
router.post("/2fa/backup-codes/regenerate", requireAuth, twoFactorVerifyLimiter, validate(twoFactorBackupCodesRegenerateSchema), asyncHandler(regenerateTwoFactorBackupCodes));

export default router;
