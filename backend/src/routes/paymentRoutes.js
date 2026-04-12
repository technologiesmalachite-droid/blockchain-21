import { Router } from "express";
import { createPaymentIntent, getPaymentIntents, processPaymentWebhook } from "../controllers/paymentController.js";
import { requireAuth } from "../middleware/auth.js";
import { requireActiveAccount, requireConsents, requireKycApproved, requireVerifiedContact } from "../middleware/security.js";
import { validate } from "../middleware/validate.js";
import { paymentIntentSchema, paymentWebhookSchema } from "../models/schemas.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.get("/intents", requireAuth, requireActiveAccount, requireConsents, asyncHandler(getPaymentIntents));
router.post(
  "/intents",
  requireAuth,
  requireActiveAccount,
  requireConsents,
  requireVerifiedContact,
  requireKycApproved,
  validate(paymentIntentSchema),
  asyncHandler(createPaymentIntent),
);
router.post("/webhooks/provider", validate(paymentWebhookSchema), asyncHandler(processPaymentWebhook));

export default router;
