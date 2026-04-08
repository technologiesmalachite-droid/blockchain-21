import { Router } from "express";
import { getKycStatus, submitKyc } from "../controllers/kycController.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { kycSchema } from "../models/schemas.js";

const router = Router();

router.post("/submit", requireAuth, validate(kycSchema), submitKyc);
router.get("/status", requireAuth, getKycStatus);

export default router;

