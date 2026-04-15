import { Router } from "express";
import {
  cancelOrder,
  createConversion,
  createOrder,
  createQuote,
  getOrders,
  getOpenOrders,
  getTradeHistory,
} from "../controllers/tradeController.js";
import { requireAuth } from "../middleware/auth.js";
import { requireActiveAccount, requireConsents, requireKycApproved, requireVerifiedContact } from "../middleware/security.js";
import { validate } from "../middleware/validate.js";
import { convertSchema, orderSchema, quoteSchema } from "../models/schemas.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { tradeCancelLimiter, tradeOrderLimiter } from "../middleware/rateLimits.js";

const router = Router();

router.post("/quote", requireAuth, requireActiveAccount, requireConsents, validate(quoteSchema), asyncHandler(createQuote));
router.post(
  "/order",
  requireAuth,
  requireActiveAccount,
  requireConsents,
  requireVerifiedContact,
  requireKycApproved,
  tradeOrderLimiter,
  validate(orderSchema),
  asyncHandler(createOrder),
);
router.post("/convert", requireAuth, requireActiveAccount, requireConsents, requireVerifiedContact, requireKycApproved, validate(convertSchema), asyncHandler(createConversion));
router.delete("/order/:orderId", requireAuth, requireActiveAccount, requireConsents, tradeCancelLimiter, asyncHandler(cancelOrder));
router.post("/cancel/:id", requireAuth, requireActiveAccount, requireConsents, tradeCancelLimiter, asyncHandler(cancelOrder));
router.get("/orders", requireAuth, requireActiveAccount, requireConsents, asyncHandler(getOrders));
router.get("/open-orders", requireAuth, requireActiveAccount, requireConsents, asyncHandler(getOpenOrders));
router.get("/history", requireAuth, requireActiveAccount, requireConsents, asyncHandler(getTradeHistory));

export default router;
