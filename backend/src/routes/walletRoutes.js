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

const router = Router();

router.get("/balances", requireAuth, requireActiveAccount, requireConsents, getBalances);
router.get("/wallets", requireAuth, requireActiveAccount, requireConsents, getWallets);
router.post("/wallets", requireAuth, requireActiveAccount, requireConsents, validate(walletCreateSchema), createWallet);
router.post("/transfer", requireAuth, requireActiveAccount, requireConsents, validate(walletTransferSchema), transferWalletFunds);
router.post("/deposit-address", requireAuth, requireActiveAccount, requireConsents, requireVerifiedContact, validate(depositAddressSchema), generateDepositAddress);
router.post("/deposit-request", requireAuth, requireActiveAccount, requireConsents, requireVerifiedContact, validate(walletRequestSchema), createDepositRequest);
router.post(
  "/withdraw-request",
  requireAuth,
  requireActiveAccount,
  requireConsents,
  requireVerifiedContact,
  requireKycApproved,
  validate(walletRequestSchema),
  requireTwoFactorForWithdrawal,
  createWithdrawRequest,
);
router.get("/history", requireAuth, requireActiveAccount, requireConsents, getWalletHistory);
router.get("/ledger", requireAuth, requireActiveAccount, requireConsents, getLedgerHistory);

export default router;
