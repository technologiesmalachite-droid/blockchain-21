import { Router } from "express";
import { createDepositRequest, createWithdrawRequest, getBalances, getWalletHistory } from "../controllers/walletController.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { walletRequestSchema } from "../models/schemas.js";

const router = Router();

router.get("/balances", requireAuth, getBalances);
router.post("/deposit-request", requireAuth, validate(walletRequestSchema), createDepositRequest);
router.post("/withdraw-request", requireAuth, validate(walletRequestSchema), createWithdrawRequest);
router.get("/history", requireAuth, getWalletHistory);

export default router;

