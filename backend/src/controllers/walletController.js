import QRCode from "qrcode";
import {
  createDepositRecord,
  createWalletRecord,
  getUserWallets,
  getWalletBalances,
  listLedgerEntries,
  transferBetweenWallets,
} from "../services/walletEngine.js";
import { createAddressQrcodePayload, getOrCreateDepositAddress, getWalletAddressBook } from "../services/walletAddressService.js";
import {
  createBuyCryptoIntent,
  createCashOutIntent,
  createSellCryptoIntent,
  estimateWithdrawalFee,
  submitDepositIntent,
  submitWithdrawalIntent,
} from "../services/walletFundingService.js";
import { processDepositWebhook } from "../services/walletDepositService.js";
import { getWalletSummary, getWalletAssetDetail } from "../services/walletService.js";
import { getWalletTransactionByHash, getWalletTransactionById, listWalletTransactions } from "../services/walletTransactionService.js";
import { confirmWalletSwap, createWalletSwapQuote } from "../services/walletSwapService.js";
import { notifyUser } from "../services/notificationService.js";

const INFRASTRUCTURE_ERROR_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "EPIPE",
  "57P01",
  "57P02",
  "57P03",
  "53300",
  "08000",
  "08001",
  "08003",
  "08006",
]);

const isInfrastructureIssue = (error) => {
  if (!error) {
    return false;
  }

  const code = typeof error.code === "string" ? error.code : "";
  if (INFRASTRUCTURE_ERROR_CODES.has(code)) {
    return true;
  }

  const message = typeof error.message === "string" ? error.message.toLowerCase() : "";
  return (
    message.includes("database") ||
    message.includes("db") ||
    message.includes("connection") ||
    message.includes("connect") ||
    message.includes("timeout") ||
    message.includes("pool")
  );
};

const resolveErrorStatus = (error, fallback = 400) => {
  if (isInfrastructureIssue(error)) {
    return 503;
  }

  if (Number.isInteger(error?.statusCode)) {
    return error.statusCode;
  }

  const message = typeof error?.message === "string" ? error.message.toLowerCase() : "";
  if (message.includes("not found")) {
    return 404;
  }

  if (message.includes("unauthorized") || message.includes("invalid token")) {
    return 401;
  }

  if (message.includes("forbidden") || message.includes("restricted")) {
    return 403;
  }

  if (message.includes("already") || message.includes("conflict")) {
    return 409;
  }

  return fallback;
};

const sendError = (res, error, fallbackMessage, fallbackStatus = 400) => {
  const status = resolveErrorStatus(error, fallbackStatus);
  const infraMessage = "Wallet infrastructure is temporarily unavailable. Please try again shortly.";
  const message = isInfrastructureIssue(error)
    ? infraMessage
    : typeof error?.message === "string" && error.message.trim()
      ? error.message
      : fallbackMessage;
  return res.status(status).json({ message });
};

export const getBalances = async (req, res) => {
  try {
    const { wallets, totalBalance } = await getWalletBalances(req.user.id);

    const balances = wallets.map((wallet) => ({
      asset: wallet.asset,
      walletType: wallet.walletType,
      balance: wallet.totalBalance,
      available: wallet.availableBalance,
      locked: wallet.lockedBalance,
      availableBalance: wallet.availableBalance,
      lockedBalance: wallet.lockedBalance,
      available_balance: wallet.availableBalance,
      locked_balance: wallet.lockedBalance,
      averageCost: wallet.averageCost,
    }));

    return res.json({
      wallets,
      balances,
      totalBalance,
    });
  } catch (error) {
    return sendError(res, error, "Unable to fetch wallet balances.", 503);
  }
};

export const getWalletSummaryController = async (req, res) => {
  try {
    const summary = await getWalletSummary(req.user.id);
    return res.json(summary);
  } catch (error) {
    return sendError(res, error, "Unable to fetch wallet summary.", 503);
  }
};

export const getWallets = async (req, res) => {
  const wallets = await getUserWallets(req.user.id);
  return res.json({ items: wallets });
};

export const getWalletAssetDetailController = async (req, res) => {
  try {
    const detail = await getWalletAssetDetail({
      userId: req.user.id,
      asset: req.validated.params.asset,
      walletType: req.validated.query?.walletType,
    });

    return res.json(detail);
  } catch (error) {
    return sendError(res, error, "Unable to fetch wallet asset details.", 404);
  }
};

export const createWallet = async (req, res) => {
  try {
    const wallet = await createWalletRecord({
      userId: req.user.id,
      walletType: req.validated.body.walletType,
      asset: req.validated.body.asset,
    });

    return res.status(201).json({ wallet, message: "Wallet ready." });
  } catch (error) {
    return sendError(res, error, "Unable to create wallet record.");
  }
};

export const transferWalletFunds = async (req, res) => {
  try {
    const transferRecord = await transferBetweenWallets({
      user: req.user,
      asset: req.validated.body.asset,
      amount: req.validated.body.amount,
      fromWalletType: req.validated.body.fromWalletType,
      toWalletType: req.validated.body.toWalletType,
    });

    return res.status(201).json({ record: transferRecord, message: "Wallet transfer completed." });
  } catch (error) {
    return sendError(res, error, "Unable to transfer wallet funds.");
  }
};

export const generateDepositAddress = async (req, res) => {
  try {
    const record = await getOrCreateDepositAddress({
      userId: req.user.id,
      asset: req.validated.body.asset,
      network: req.validated.body.network,
      walletType: req.validated.body.walletType,
    });

    const qrPayload = createAddressQrcodePayload(record);
    const qrCodeDataUrl = await QRCode.toDataURL(qrPayload, {
      margin: 1,
      width: 260,
    });

    return res.status(201).json({
      id: record.id,
      address: record.address,
      memo: record.memo,
      network: record.network,
      asset: record.asset,
      walletType: record.walletType,
      expiresAt: record.expiresAt,
      memoRequired: record.memoRequired,
      warnings: record.warnings,
      qrCodeDataUrl,
    });
  } catch (error) {
    return sendError(res, error, "Unable to generate wallet deposit address.");
  }
};

export const getDepositAddressBook = async (req, res) => {
  try {
    const items = await getWalletAddressBook({
      userId: req.user.id,
      asset: req.validated.query.asset,
      walletType: req.validated.query.walletType,
    });

    return res.json({ items });
  } catch (error) {
    return sendError(res, error, "Unable to fetch deposit addresses.");
  }
};

export const processDepositWebhookController = async (req, res) => {
  try {
    const result = await processDepositWebhook({
      headers: req.headers,
      rawBody: req.rawBody,
      payload: req.validated.body,
    });

    return res.status(result.ignored ? 202 : 200).json(result);
  } catch (error) {
    return sendError(res, error, "Unable to process deposit webhook.", 400);
  }
};

export const createDepositRequest = async (req, res) => {
  try {
    const record = await submitDepositIntent({
      user: req.user,
      asset: req.validated.body.asset,
      network: req.validated.body.network,
      amount: req.validated.body.amount,
      walletType: req.validated.body.walletType,
      address: req.validated.body.address || "pending_custody_assignment",
    });

    await notifyUser({
      userId: req.user.id,
      category: "wallet",
      severity: "info",
      title: "Deposit request created",
      message: `Deposit request for ${record.amount} ${record.asset} is now ${record.status}.`,
      actionUrl: "/wallet",
      metadata: {
        transactionId: record.id,
      },
    });

    return res.status(201).json({ record, message: "Deposit request created." });
  } catch (error) {
    return sendError(res, error, "Unable to create deposit request.");
  }
};

export const estimateWithdrawalFeeController = async (req, res) => {
  try {
    const estimate = estimateWithdrawalFee({
      asset: req.validated.body.asset,
      network: req.validated.body.network,
      amount: req.validated.body.amount,
    });

    return res.json({ estimate });
  } catch (error) {
    return sendError(res, error, "Unable to estimate withdrawal fee.");
  }
};

export const createWithdrawRequest = async (req, res) => {
  try {
    const record = await submitWithdrawalIntent({
      user: req.user,
      asset: req.validated.body.asset,
      network: req.validated.body.network,
      amount: req.validated.body.amount,
      address: req.validated.body.address,
      walletType: req.validated.body.walletType,
    });

    await notifyUser({
      userId: req.user.id,
      category: "wallet",
      severity: "warning",
      title: "Withdrawal request submitted",
      message: `Withdrawal request for ${record.amount} ${record.asset} is ${record.status}.`,
      actionUrl: "/wallet",
      metadata: {
        transactionId: record.id,
        network: record.network,
      },
    });

    return res.status(201).json({ record, message: "Withdrawal request received." });
  } catch (error) {
    return sendError(res, error, "Unable to submit withdrawal request.");
  }
};

export const getWalletHistory = async (req, res) => {
  try {
    const payload = await listWalletTransactions({
      userId: req.user.id,
      filters: req.validated.query,
    });

    return res.json(payload);
  } catch (error) {
    return sendError(res, error, "Unable to fetch wallet transactions.", 503);
  }
};

export const getWalletTransactionByIdController = async (req, res) => {
  try {
    const transaction = await getWalletTransactionById({
      userId: req.user.id,
      transactionId: req.validated.params.id,
    });

    return res.json({ transaction });
  } catch (error) {
    return sendError(res, error, "Transaction not found.", 404);
  }
};

export const getWalletTransactionByHashController = async (req, res) => {
  try {
    const transaction = await getWalletTransactionByHash({
      userId: req.user.id,
      txHash: req.validated.params.hash,
    });

    return res.json({ transaction });
  } catch (error) {
    return sendError(res, error, "Transaction hash not found.", 404);
  }
};

export const getLedgerHistory = async (req, res) => {
  return res.json({ items: await listLedgerEntries(req.user.id, 100) });
};

export const createSwapQuoteController = async (req, res) => {
  try {
    const quote = await createWalletSwapQuote({
      user: req.user,
      fromAsset: req.validated.body.fromAsset,
      toAsset: req.validated.body.toAsset,
      amount: req.validated.body.amount,
      walletType: req.validated.body.walletType,
      slippageBps: req.validated.body.slippageBps,
    });

    return res.status(201).json({ quote, message: "Swap quote generated." });
  } catch (error) {
    return sendError(res, error, "Unable to create swap quote.");
  }
};

export const confirmSwapController = async (req, res) => {
  try {
    const swap = await confirmWalletSwap({
      user: req.user,
      quoteId: req.validated.body.quoteId,
    });

    await notifyUser({
      userId: req.user.id,
      category: "wallet",
      severity: "success",
      title: "Swap completed",
      message: `Converted ${swap.fromAmount} ${swap.fromAsset} to ${swap.toAmount} ${swap.toAsset}.`,
      actionUrl: "/wallet",
      metadata: {
        quoteId: swap.quoteId,
        transactionId: swap.transactionId,
      },
    });

    return res.status(201).json({ swap, message: "Swap completed." });
  } catch (error) {
    return sendError(res, error, "Unable to complete swap.");
  }
};

export const createWalletBuyIntentController = async (_req, res) => {
  try {
    const intent = await createBuyCryptoIntent();
    return res.status(201).json({ intent });
  } catch (error) {
    return sendError(res, error, "Buy integration is unavailable.", 501);
  }
};

export const createWalletSellIntentController = async (_req, res) => {
  try {
    const intent = await createSellCryptoIntent();
    return res.status(201).json({ intent });
  } catch (error) {
    return sendError(res, error, "Sell integration is unavailable.", 501);
  }
};

export const createWalletCashoutIntentController = async (_req, res) => {
  try {
    const intent = await createCashOutIntent();
    return res.status(201).json({ intent });
  } catch (error) {
    return sendError(res, error, "Cash-out integration is unavailable.", 501);
  }
};
