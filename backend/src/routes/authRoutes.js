import { Router } from "express";
import { login, logout, refresh, register } from "../controllers/authController.js";
import { validate } from "../middleware/validate.js";
import { loginSchema, registerSchema } from "../models/schemas.js";

const router = Router();

router.post("/register", validate(registerSchema), register);
router.post("/login", validate(loginSchema), login);
router.post("/logout", logout);
router.post("/refresh", refresh);

export default router;

