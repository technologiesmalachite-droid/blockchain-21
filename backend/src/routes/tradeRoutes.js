import { Router } from "express";
import { createOrder, getOpenOrders, getTradeHistory } from "../controllers/tradeController.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { orderSchema } from "../models/schemas.js";

const router = Router();

router.post("/order", requireAuth, validate(orderSchema), createOrder);
router.get("/open-orders", requireAuth, getOpenOrders);
router.get("/history", requireAuth, getTradeHistory);

export default router;

