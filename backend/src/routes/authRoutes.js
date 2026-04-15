import { Router } from "express";
import {
  firebaseSession,
  getSessionHistory,
  login,
  logout,
  refresh,
  register,
  sendVerification,
  setupTwoFactor,
  verifyContact,
} from "../controllers/authController.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  firebaseSessionSchema,
  loginSchema,
  registerSchema,
  sendVerificationSchema,
  twoFactorSetupSchema,
  verifyContactSchema,
} from "../models/schemas.js";
import { authAttemptLimiter } from "../middleware/rateLimits.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.post("/register", authAttemptLimiter, validate(registerSchema), asyncHandler(register));
router.post("/login", authAttemptLimiter, validate(loginSchema), asyncHandler(login));
router.post("/firebase/session", authAttemptLimiter, validate(firebaseSessionSchema), asyncHandler(firebaseSession));
router.post("/logout", asyncHandler(logout));
router.post("/refresh", authAttemptLimiter, asyncHandler(refresh));

router.get("/sessions", requireAuth, asyncHandler(getSessionHistory));
router.post("/verification/send", requireAuth, authAttemptLimiter, validate(sendVerificationSchema), asyncHandler(sendVerification));
router.post("/verification/confirm", requireAuth, authAttemptLimiter, validate(verifyContactSchema), asyncHandler(verifyContact));
router.post("/2fa/setup", requireAuth, validate(twoFactorSetupSchema), asyncHandler(setupTwoFactor));

export default router;
