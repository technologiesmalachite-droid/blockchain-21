import { Router } from "express";
import {
  createDepositRequest,
  createWallet,
  createWithdrawRequest,
  generateDepositAddress,
  getBalances,
  getLedgerHistory,
  getWalletHistory,
  getWallets,
  transferWalletFunds,
} from "../controllers/walletController.js";
import { requireAuth } from "../middleware/auth.js";
import {
  requireActiveAccount,
  requireConsents,
  requireKycApproved,
  requireTwoFactorForWithdrawal,
  requireVerifiedContact,
} from "../middleware/security.js";
import { validate } from "../middleware/validate.js";
import {
  depositAddressSchema,
  walletCreateSchema,
  walletRequestSchema,
  walletTransferSchema,
} from "../models/schemas.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.get("/balances", requireAuth, requireActiveAccount, requireConsents, asyncHandler(getBalances));
router.get("/wallets", requireAuth, requireActiveAccount, requireConsents, asyncHandler(getWallets));
router.post("/wallets", requireAuth, requireActiveAccount, requireConsents, validate(walletCreateSchema), asyncHandler(createWallet));
router.post("/transfer", requireAuth, requireActiveAccount, requireConsents, validate(walletTransferSchema), asyncHandler(transferWalletFunds));
router.post("/deposit-address", requireAuth, requireActiveAccount, requireConsents, requireVerifiedContact, validate(depositAddressSchema), asyncHandler(generateDepositAddress));
router.post("/deposit-request", requireAuth, requireActiveAccount, requireConsents, requireVerifiedContact, validate(walletRequestSchema), asyncHandler(createDepositRequest));
router.post(
  "/withdraw-request",
  requireAuth,
  requireActiveAccount,
  requireConsents,
  requireVerifiedContact,
  requireKycApproved,
  validate(walletRequestSchema),
  requireTwoFactorForWithdrawal,
  asyncHandler(createWithdrawRequest),
);
router.get("/history", requireAuth, requireActiveAccount, requireConsents, asyncHandler(getWalletHistory));
router.get("/ledger", requireAuth, requireActiveAccount, requireConsents, asyncHandler(getLedgerHistory));

export default router;
