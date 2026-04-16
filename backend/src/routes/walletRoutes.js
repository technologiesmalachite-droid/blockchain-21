import { Router } from "express";
import {
  confirmSwapController,
  createSwapQuoteController,
  createWalletBuyIntentController,
  createWalletCashoutIntentController,
  createWalletSellIntentController,
  createDepositRequest,
  estimateWithdrawalFeeController,
  processDepositWebhookController,
  createWallet,
  createWithdrawRequest,
  getDepositAddressBook,
  getWalletAssetDetailController,
  generateDepositAddress,
  getBalances,
  getWalletSummaryController,
  getLedgerHistory,
  getWalletHistory,
  getWalletTransactionByHashController,
  getWalletTransactionByIdController,
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
  walletAddressBookQuerySchema,
  walletAssetDetailSchema,
  walletBuySellIntentSchema,
  walletHistoryQuerySchema,
  walletSwapConfirmSchema,
  walletSwapQuoteSchema,
  walletDepositWebhookSchema,
  walletTransactionHashSchema,
  walletTransactionIdSchema,
  walletWithdrawEstimateSchema,
  depositAddressSchema,
  walletCreateSchema,
  walletRequestSchema,
  walletTransferSchema,
} from "../models/schemas.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { walletActionLimiter, walletSwapLimiter, walletWithdrawalLimiter } from "../middleware/rateLimits.js";

const router = Router();

router.post("/webhooks/deposit", validate(walletDepositWebhookSchema), asyncHandler(processDepositWebhookController));
router.get("/balances", requireAuth, requireActiveAccount, requireConsents, asyncHandler(getBalances));
router.get("/summary", requireAuth, requireActiveAccount, requireConsents, asyncHandler(getWalletSummaryController));
router.get("/wallets", requireAuth, requireActiveAccount, requireConsents, asyncHandler(getWallets));
router.get("/assets/:asset", requireAuth, requireActiveAccount, requireConsents, validate(walletAssetDetailSchema), asyncHandler(getWalletAssetDetailController));
router.post("/wallets", requireAuth, requireActiveAccount, requireConsents, validate(walletCreateSchema), asyncHandler(createWallet));
router.post("/transfer", requireAuth, requireActiveAccount, requireConsents, walletActionLimiter, validate(walletTransferSchema), asyncHandler(transferWalletFunds));
router.get("/deposit-addresses", requireAuth, requireActiveAccount, requireConsents, validate(walletAddressBookQuerySchema), asyncHandler(getDepositAddressBook));
router.post("/deposit-address", requireAuth, requireActiveAccount, requireConsents, walletActionLimiter, validate(depositAddressSchema), asyncHandler(generateDepositAddress));
router.get("/addresses", requireAuth, requireActiveAccount, requireConsents, validate(walletAddressBookQuerySchema), asyncHandler(getDepositAddressBook));
router.post("/address/generate", requireAuth, requireActiveAccount, requireConsents, walletActionLimiter, validate(depositAddressSchema), asyncHandler(generateDepositAddress));
router.post("/deposit-request", requireAuth, requireActiveAccount, requireConsents, requireVerifiedContact, validate(walletRequestSchema), asyncHandler(createDepositRequest));
router.post(
  "/withdraw-request",
  requireAuth,
  requireActiveAccount,
  requireConsents,
  requireVerifiedContact,
  requireKycApproved,
  walletWithdrawalLimiter,
  validate(walletRequestSchema),
  requireTwoFactorForWithdrawal,
  asyncHandler(createWithdrawRequest),
);
router.post("/withdraw-estimate", requireAuth, requireActiveAccount, requireConsents, validate(walletWithdrawEstimateSchema), asyncHandler(estimateWithdrawalFeeController));
router.get("/history", requireAuth, requireActiveAccount, requireConsents, validate(walletHistoryQuerySchema), asyncHandler(getWalletHistory));
router.get("/transactions", requireAuth, requireActiveAccount, requireConsents, validate(walletHistoryQuerySchema), asyncHandler(getWalletHistory));
router.get("/transactions/:id", requireAuth, requireActiveAccount, requireConsents, validate(walletTransactionIdSchema), asyncHandler(getWalletTransactionByIdController));
router.get("/transactions/hash/:hash", requireAuth, requireActiveAccount, requireConsents, validate(walletTransactionHashSchema), asyncHandler(getWalletTransactionByHashController));
router.post("/swap/quote", requireAuth, requireActiveAccount, requireConsents, walletSwapLimiter, validate(walletSwapQuoteSchema), asyncHandler(createSwapQuoteController));
router.post("/swap/confirm", requireAuth, requireActiveAccount, requireConsents, walletSwapLimiter, validate(walletSwapConfirmSchema), asyncHandler(confirmSwapController));
router.post("/buy/intent", requireAuth, requireActiveAccount, requireConsents, validate(walletBuySellIntentSchema), asyncHandler(createWalletBuyIntentController));
router.post("/sell/intent", requireAuth, requireActiveAccount, requireConsents, validate(walletBuySellIntentSchema), asyncHandler(createWalletSellIntentController));
router.post("/cashout/intent", requireAuth, requireActiveAccount, requireConsents, validate(walletBuySellIntentSchema), asyncHandler(createWalletCashoutIntentController));
router.get("/ledger", requireAuth, requireActiveAccount, requireConsents, asyncHandler(getLedgerHistory));

export default router;
