import { Router } from "express";
import {
  changePassword,
  disableTwoFactor,
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
import { authAttemptLimiter, twoFactorActionLimiter, twoFactorVerifyLimiter } from "../middleware/rateLimits.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.post("/register", authAttemptLimiter, validate(registerSchema), asyncHandler(register));
router.post("/login", authAttemptLimiter, validate(loginSchema), asyncHandler(login));
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
