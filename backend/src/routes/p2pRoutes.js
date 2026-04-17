import { Router } from "express";
import {
  cancelOrderController,
  createOfferController,
  createOrderController,
  createPaymentMethodController,
  deletePaymentMethodController,
  getMarketplaceOffersController,
  getOfferController,
  getOrderController,
  getP2pConfigController,
  listMyOffersController,
  listOrdersController,
  listOrderMessagesController,
  listPaymentMethodsController,
  markOrderPaidController,
  openDisputeController,
  postOrderMessageController,
  releaseOrderController,
  updateOfferStatusController,
  updatePaymentMethodController,
} from "../controllers/p2pController.js";
import { requireAuth } from "../middleware/auth.js";
import {
  requireActiveAccount,
  requireConsents,
  requireKycApproved,
  requireVerifiedContact,
} from "../middleware/security.js";
import { validate } from "../middleware/validate.js";
import {
  p2pCancelOrderSchema,
  p2pCreateOfferSchema,
  p2pCreateOrderSchema,
  p2pDisputeSchema,
  p2pMarketplaceQuerySchema,
  p2pMessageSchema,
  p2pMethodIdSchema,
  p2pOfferIdSchema,
  p2pOrderIdSchema,
  p2pOrderListQuerySchema,
  p2pPaymentMethodsQuerySchema,
  p2pPaymentMethodSchema,
  p2pPaymentMethodUpdateSchema,
  p2pStatusUpdateSchema,
} from "../models/schemas.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { p2pMessageLimiter, p2pOrderActionLimiter, p2pOrderCreateLimiter } from "../middleware/rateLimits.js";

const router = Router();

router.use(requireAuth, requireActiveAccount, requireConsents, requireVerifiedContact, requireKycApproved);

router.get("/config", asyncHandler(getP2pConfigController));

router.get("/marketplace/offers", validate(p2pMarketplaceQuerySchema), asyncHandler(getMarketplaceOffersController));
router.get("/offers/mine", asyncHandler(listMyOffersController));
router.post("/offers", validate(p2pCreateOfferSchema), asyncHandler(createOfferController));
router.get("/offers/:offerId", validate(p2pOfferIdSchema), asyncHandler(getOfferController));
router.patch("/offers/:offerId/status", validate(p2pStatusUpdateSchema), asyncHandler(updateOfferStatusController));
router.post("/offers/:offerId/orders", p2pOrderCreateLimiter, validate(p2pCreateOrderSchema), asyncHandler(createOrderController));

router.get("/payment-methods", validate(p2pPaymentMethodsQuerySchema), asyncHandler(listPaymentMethodsController));
router.post("/payment-methods", validate(p2pPaymentMethodSchema), asyncHandler(createPaymentMethodController));
router.put("/payment-methods/:methodId", validate(p2pPaymentMethodUpdateSchema), asyncHandler(updatePaymentMethodController));
router.delete("/payment-methods/:methodId", validate(p2pMethodIdSchema), asyncHandler(deletePaymentMethodController));

router.get("/orders", validate(p2pOrderListQuerySchema), asyncHandler(listOrdersController));
router.get("/orders/:orderId", validate(p2pOrderIdSchema), asyncHandler(getOrderController));
router.post("/orders/:orderId/mark-paid", p2pOrderActionLimiter, validate(p2pOrderIdSchema), asyncHandler(markOrderPaidController));
router.post("/orders/:orderId/release", p2pOrderActionLimiter, validate(p2pOrderIdSchema), asyncHandler(releaseOrderController));
router.post("/orders/:orderId/cancel", p2pOrderActionLimiter, validate(p2pCancelOrderSchema), asyncHandler(cancelOrderController));
router.post("/orders/:orderId/dispute", p2pOrderActionLimiter, validate(p2pDisputeSchema), asyncHandler(openDisputeController));
router.get("/orders/:orderId/messages", validate(p2pOrderIdSchema), asyncHandler(listOrderMessagesController));
router.post("/orders/:orderId/messages", p2pMessageLimiter, validate(p2pMessageSchema), asyncHandler(postOrderMessageController));

export default router;
