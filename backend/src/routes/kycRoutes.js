import { Router } from "express";
import { getKycOptions, getKycStatus, submitKyc } from "../controllers/kycController.js";
import { requireAuth } from "../middleware/auth.js";
import { requireActiveAccount, requireConsents } from "../middleware/security.js";
import { validate } from "../middleware/validate.js";
import { kycOptionsSchema, kycSchema } from "../models/schemas.js";

const router = Router();

router.get("/options/:countryCode", requireAuth, requireActiveAccount, validate(kycOptionsSchema), getKycOptions);
router.post("/submit", requireAuth, requireActiveAccount, requireConsents, validate(kycSchema), submitKyc);
router.get("/status", requireAuth, requireActiveAccount, getKycStatus);

export default router;
