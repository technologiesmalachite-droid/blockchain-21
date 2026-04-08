import { Router } from "express";
import { getProfile, updateProfile } from "../controllers/userController.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { profileSchema } from "../models/schemas.js";

const router = Router();

router.get("/profile", requireAuth, getProfile);
router.put("/profile", requireAuth, validate(profileSchema), updateProfile);

export default router;

