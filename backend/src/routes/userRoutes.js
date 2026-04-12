import { Router } from "express";
import { getProfile, updateProfile } from "../controllers/userController.js";
import { requireAuth } from "../middleware/auth.js";
import { requireActiveAccount, requireConsents } from "../middleware/security.js";
import { validate } from "../middleware/validate.js";
import { profileSchema } from "../models/schemas.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.get("/profile", requireAuth, requireActiveAccount, asyncHandler(getProfile));
router.put("/profile", requireAuth, requireActiveAccount, requireConsents, validate(profileSchema), asyncHandler(updateProfile));

export default router;
