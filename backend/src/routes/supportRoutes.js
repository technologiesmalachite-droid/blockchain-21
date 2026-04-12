import { Router } from "express";
import { createTicket, getSupportTickets } from "../controllers/supportController.js";
import { requireAuth } from "../middleware/auth.js";
import { requireActiveAccount, requireConsents } from "../middleware/security.js";
import { validate } from "../middleware/validate.js";
import { supportSchema } from "../models/schemas.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.get("/", requireAuth, requireActiveAccount, requireConsents, asyncHandler(getSupportTickets));
router.post("/", requireAuth, requireActiveAccount, requireConsents, validate(supportSchema), asyncHandler(createTicket));

export default router;
