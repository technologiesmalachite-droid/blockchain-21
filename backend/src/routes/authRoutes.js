import { Router } from "express";
import {
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
  loginSchema,
  registerSchema,
  sendVerificationSchema,
  twoFactorSetupSchema,
  verifyContactSchema,
} from "../models/schemas.js";

const router = Router();

router.post("/register", validate(registerSchema), register);
router.post("/login", validate(loginSchema), login);
router.post("/logout", logout);
router.post("/refresh", refresh);

router.get("/sessions", requireAuth, getSessionHistory);
router.post("/verification/send", requireAuth, validate(sendVerificationSchema), sendVerification);
router.post("/verification/confirm", requireAuth, validate(verifyContactSchema), verifyContact);
router.post("/2fa/setup", requireAuth, validate(twoFactorSetupSchema), setupTwoFactor);

export default router;
