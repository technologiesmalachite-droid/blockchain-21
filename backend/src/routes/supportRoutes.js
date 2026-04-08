import { Router } from "express";
import { createTicket, getSupportTickets } from "../controllers/supportController.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { supportSchema } from "../models/schemas.js";

const router = Router();

router.get("/", requireAuth, getSupportTickets);
router.post("/", requireAuth, validate(supportSchema), createTicket);

export default router;

