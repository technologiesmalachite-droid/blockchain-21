import { Router } from "express";
import { getProfile, updateProfile } from "../controllers/userController.js";
import { requireAuth } from "../middleware/auth.js";
import { requireActiveAccount, requireConsents } from "../middleware/security.js";
import { validate } from "../middleware/validate.js";
import { profileSchema } from "../models/schemas.js";

const router = Router();

router.get("/profile", requireAuth, requireActiveAccount, getProfile);
router.put("/profile", requireAuth, requireActiveAccount, requireConsents, validate(profileSchema), updateProfile);

export default router;
