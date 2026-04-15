import { v4 as uuid } from "uuid";
import { withTransaction } from "../db/transaction.js";
import { auditLogsRepository } from "../repositories/auditLogsRepository.js";
import { conversionsRepository } from "../repositories/conversionsRepository.js";
import { marketsRepository } from "../repositories/marketsRepository.js";
import { swapRecordsRepository } from "../repositories/swapRecordsRepository.js";
import { tradesRepository } from "../repositories/tradesRepository.js";
import { walletTransactionsRepository } from "../repositories/walletTransactionsRepository.js";
import { walletsRepository } from "../repositories/walletsRepository.js";
import { toDecimal, toNumber } from "../utils/decimal.js";
import { creditWallet, debitWallet } from "./walletEngine.js";
import {
  assertSupportedAsset,
  getSwapFeeRate,
  getSwapQuoteExpiryMs,
  normalizeWalletType,
} from "./walletCatalogService.js";

const roundAmount = (value, precision = 10) => toNumber(value, precision);

const resolveSwapRate = async ({ fromAsset, toAsset }, db) => {
  const directSymbol = `${fromAsset}${toAsset}`;
  const inverseSymbol = `${toAsset}${fromAsset}`;

  const direct = await marketsRepository.findBySymbol(directSymbol, db);
  if (direct && Number(direct.lastPrice) > 0) {
    return {
      symbol: direct.symbol,
      direction: "direct",
      price: Number(direct.lastPrice),
      precision: Number(direct.pricePrecision || 8),
      quantityPrecision: Number(direct.quantityPrecision || 8),
      source: "market_pair",
    };
  }

  const inverse = await marketsRepository.findBySymbol(inverseSymbol, db);
  if (inverse && Number(inverse.lastPrice) > 0) {
    return {
      symbol: inverse.symbol,
      direction: "inverse",
      price: Number(inverse.lastPrice),
      precision: Number(inverse.pricePrecision || 8),
      quantityPrecision: Number(inverse.quantityPrecision || 8),
      source: "market_pair",
    };
  }

  throw new Error(`Swap pair ${fromAsset}/${toAsset} is unavailable.`);
};

const quoteToAmount = ({ amountAfterFee, rate }) => {
  if (rate.direction === "direct") {
    return roundAmount(toDecimal(amountAfterFee).mul(toDecimal(rate.price)));
  }

  return roundAmount(toDecimal(amountAfterFee).div(toDecimal(rate.price)));
};

const mapSwapQuote = (quote) => ({
  quoteId: quote.id,
  walletType: quote.walletType,
  fromAsset: quote.fromAsset,
  toAsset: quote.toAsset,
  fromAmount: Number(quote.fromAmount),
  toAmount: Number(quote.toAmount),
  rate: Number(quote.quotedRate),
  feeAmount: Number(quote.feeAmount || 0),
  feeRateBps: Number(quote.feeRateBps || 0),
  slippageBps: Number(quote.slippageBps || 0),
  status: quote.status,
  quoteExpiresAt: quote.quoteExpiresAt,
  createdAt: quote.createdAt,
});

const mapSwapResult = (quote, walletTransaction, conversion, trade) => ({
  ...mapSwapQuote(quote),
  status: "completed",
  transactionId: walletTransaction.id,
  txHash: walletTransaction.txHash,
  conversionId: conversion.id,
  tradeId: trade.id,
  completedAt: walletTransaction.completedAt || walletTransaction.createdAt,
});

export const createWalletSwapQuote = async ({ user, fromAsset, toAsset, amount, walletType = "funding", slippageBps = 50 }) => {
  const { asset: normalizedFrom } = assertSupportedAsset(fromAsset);
  const { asset: normalizedTo } = assertSupportedAsset(toAsset);

  if (normalizedFrom === normalizedTo) {
    throw new Error("Swap source and destination assets must be different.");
  }

  const resolvedWalletType = normalizeWalletType(walletType);
  const normalizedAmount = roundAmount(amount);

  if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
    throw new Error("Swap amount must be greater than zero.");
  }

  return withTransaction(async (db) => {
    const [rate, sourceWallet, destinationWallet] = await Promise.all([
      resolveSwapRate({ fromAsset: normalizedFrom, toAsset: normalizedTo }, db),
      walletsRepository.findByUserTypeAsset({ userId: user.id, walletType: resolvedWalletType, asset: normalizedFrom }, db),
      walletsRepository.findByUserTypeAsset({ userId: user.id, walletType: resolvedWalletType, asset: normalizedTo }, db),
    ]);

    if (!sourceWallet) {
      throw new Error(`No ${normalizedFrom} wallet found in ${resolvedWalletType} balance.`);
    }

    const availableBalance = toDecimal(sourceWallet.availableBalance || 0);
    if (availableBalance.lessThan(normalizedAmount)) {
      throw new Error(`Insufficient ${normalizedFrom} balance for this swap.`);
    }

    const feeRate = toDecimal(getSwapFeeRate());
    const feeAmount = roundAmount(toDecimal(normalizedAmount).mul(feeRate));
    const amountAfterFee = roundAmount(toDecimal(normalizedAmount).minus(toDecimal(feeAmount)));

    if (amountAfterFee <= 0) {
      throw new Error("Swap amount is too small after fees.");
    }

    const toAmount = quoteToAmount({ amountAfterFee, rate });
    if (toAmount <= 0) {
      throw new Error("Swap quote could not be generated for this amount.");
    }

    const quoteExpiry = new Date(Date.now() + getSwapQuoteExpiryMs()).toISOString();
    const quotedRate = rate.direction === "direct" ? rate.price : roundAmount(toDecimal(1).div(toDecimal(rate.price)), 12);

    const quote = await swapRecordsRepository.create(
      {
        userId: user.id,
        fromWalletId: sourceWallet.id,
        toWalletId: destinationWallet?.id || null,
        walletType: resolvedWalletType,
        fromAsset: normalizedFrom,
        toAsset: normalizedTo,
        fromAmount: normalizedAmount,
        toAmount,
        quotedRate,
        feeRateBps: Math.round(Number(feeRate) * 10000),
        feeAmount,
        slippageBps: Math.max(0, Number(slippageBps || 0)),
        quoteExpiresAt: quoteExpiry,
        status: "quoted",
        idempotencyKey: `swap_quote_${user.id}_${uuid()}`,
        metadata: {
          marketSymbol: rate.symbol,
          pricingDirection: rate.direction,
          pricingSource: rate.source,
          provider: "internal_liquidity",
        },
      },
      db,
    );

    await auditLogsRepository.create(
      {
        action: "wallet_swap_quote_created",
        actorId: user.id,
        actorRole: user.role,
        resourceType: "swap_quote",
        resourceId: quote.id,
        metadata: {
          fromAsset: normalizedFrom,
          toAsset: normalizedTo,
          fromAmount: normalizedAmount,
          toAmount,
          feeAmount,
          quoteExpiresAt: quoteExpiry,
        },
      },
      db,
    );

    return mapSwapQuote(quote);
  });
};

export const confirmWalletSwap = async ({ user, quoteId }) => {
  return withTransaction(async (db) => {
    const quote = await swapRecordsRepository.findQuoteForUserForUpdate({ quoteId, userId: user.id }, db);

    if (!quote) {
      throw new Error("Swap quote not found.");
    }

    if (quote.status !== "quoted") {
      throw new Error("Swap quote is no longer available.");
    }

    if (quote.quoteExpiresAt && new Date(quote.quoteExpiresAt).getTime() < Date.now()) {
      await swapRecordsRepository.updateStatus(
        {
          swapId: quote.id,
          status: "expired",
          metadata: {
            expiredAt: new Date().toISOString(),
          },
        },
        db,
      );
      throw new Error("Swap quote has expired. Please request a new quote.");
    }

    await debitWallet(
      {
        userId: user.id,
        walletType: quote.walletType,
        asset: quote.fromAsset,
        amount: Number(quote.fromAmount),
        referenceType: "wallet_swap",
        referenceId: quote.id,
        description: `Swap ${quote.fromAsset} -> ${quote.toAsset}`,
        idempotencyKey: `wallet_swap_debit_${quote.id}`,
      },
      db,
    );

    const creditedWallet = await creditWallet(
      {
        userId: user.id,
        walletType: quote.walletType,
        asset: quote.toAsset,
        amount: Number(quote.toAmount),
        referenceType: "wallet_swap",
        referenceId: quote.id,
        description: `Swap receive ${quote.toAsset}`,
        idempotencyKey: `wallet_swap_credit_${quote.id}`,
      },
      db,
    );

    const conversion = await conversionsRepository.create(
      {
        userId: user.id,
        fromAsset: quote.fromAsset,
        toAsset: quote.toAsset,
        walletType: quote.walletType,
        sourceAmount: Number(quote.fromAmount),
        receivedAmount: Number(quote.toAmount),
        price: Number(quote.quotedRate),
        fee: Number(quote.feeAmount || 0),
        idempotencyKey: `wallet_swap_conversion_${quote.id}`,
        metadata: {
          swapQuoteId: quote.id,
        },
      },
      db,
    );

    const trade = await tradesRepository.create(
      {
        orderId: null,
        userId: user.id,
        symbol: `${quote.fromAsset}/${quote.toAsset}`,
        side: "convert",
        orderType: "convert",
        price: Number(quote.quotedRate),
        quantity: Number(quote.fromAmount),
        notional: Number(quote.toAmount),
        fee: Number(quote.feeAmount || 0),
        feeAsset: quote.fromAsset,
        liquidityRole: "taker",
        settlementWalletType: quote.walletType,
        idempotencyKey: `wallet_swap_trade_${quote.id}`,
        metadata: {
          swapQuoteId: quote.id,
        },
      },
      db,
    );

    const transaction = await walletTransactionsRepository.create(
      {
        userId: user.id,
        walletId: creditedWallet.id,
        transactionType: "swap",
        asset: quote.fromAsset,
        walletType: quote.walletType,
        network: "internal",
        amount: Number(quote.fromAmount),
        fee: Number(quote.feeAmount || 0),
        destinationAddress: `${quote.fromAsset} -> ${quote.toAsset}`,
        status: "completed",
        riskScore: 2,
        idempotencyKey: `wallet_swap_tx_${quote.id}`,
        txHash: `swap_${quote.id.replace(/-/g, "")}`,
        providerReference: quote.id,
        completedAt: new Date().toISOString(),
        metadata: {
          swapQuoteId: quote.id,
          receivedAsset: quote.toAsset,
          receivedAmount: Number(quote.toAmount),
          tradeId: trade.id,
          conversionId: conversion.id,
        },
      },
      db,
    );

    const updatedQuote = await swapRecordsRepository.updateStatus(
      {
        swapId: quote.id,
        status: "completed",
        toWalletId: creditedWallet.id,
        metadata: {
          walletTransactionId: transaction.id,
          conversionId: conversion.id,
          tradeId: trade.id,
          completedAt: new Date().toISOString(),
        },
      },
      db,
    );

    await auditLogsRepository.create(
      {
        action: "wallet_swap_completed",
        actorId: user.id,
        actorRole: user.role,
        resourceType: "swap",
        resourceId: quote.id,
        metadata: {
          fromAsset: quote.fromAsset,
          toAsset: quote.toAsset,
          fromAmount: Number(quote.fromAmount),
          toAmount: Number(quote.toAmount),
        },
      },
      db,
    );

    return mapSwapResult(updatedQuote || quote, transaction, conversion, trade);
  });
};
