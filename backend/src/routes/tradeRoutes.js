import { Router } from "express";
import {
  cancelOrder,
  createConversion,
  createOrder,
  createQuote,
  getOpenOrders,
  getTradeHistory,
} from "../controllers/tradeController.js";
import { requireAuth } from "../middleware/auth.js";
import { requireActiveAccount, requireConsents, requireKycApproved, requireVerifiedContact } from "../middleware/security.js";
import { validate } from "../middleware/validate.js";
import { convertSchema, orderSchema, quoteSchema } from "../models/schemas.js";

const router = Router();

router.post("/quote", requireAuth, requireActiveAccount, requireConsents, validate(quoteSchema), createQuote);
router.post("/order", requireAuth, requireActiveAccount, requireConsents, requireVerifiedContact, requireKycApproved, validate(orderSchema), createOrder);
router.post("/convert", requireAuth, requireActiveAccount, requireConsents, requireVerifiedContact, requireKycApproved, validate(convertSchema), createConversion);
router.delete("/order/:orderId", requireAuth, requireActiveAccount, requireConsents, cancelOrder);
router.get("/open-orders", requireAuth, requireActiveAccount, requireConsents, getOpenOrders);
router.get("/history", requireAuth, requireActiveAccount, requireConsents, getTradeHistory);

export default router;
