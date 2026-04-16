import { v4 as uuid } from "uuid";
import { withTransaction } from "../db/transaction.js";
import { auditLogsRepository } from "../repositories/auditLogsRepository.js";
import { balancesRepository } from "../repositories/balancesRepository.js";
import { depositRecordsRepository } from "../repositories/depositRecordsRepository.js";
import { ledgerEntriesRepository } from "../repositories/ledgerEntriesRepository.js";
import { walletLedgerEntriesRepository } from "../repositories/walletLedgerEntriesRepository.js";
import { walletTransactionsRepository } from "../repositories/walletTransactionsRepository.js";
import { walletsRepository } from "../repositories/walletsRepository.js";
import { toDecimal, toNumber } from "../utils/decimal.js";
import { withdrawalsRepository } from "../repositories/withdrawalsRepository.js";
import { withdrawalRequestsRepository } from "../repositories/withdrawalRequestsRepository.js";
import { evaluateWithdrawalRisk } from "./complianceService.js";
import { providers } from "./providerRegistry.js";
import { jobQueue } from "../workers/jobQueue.js";
import {
  assertSupportedAssetNetwork,
  getWalletAddressConfirmationCount,
  getWithdrawalFeeRate,
  normalizeWalletType,
  validateWalletAddress,
} from "./walletCatalogService.js";
import { getOrCreateDepositAddress } from "./walletAddressService.js";
import { ensureUserWalletFoundation } from "./walletFoundationService.js";

const roundAmount = (value, precision = 10) => toNumber(value, precision);

const runAtomic = async (db, executor) => {
  if (db) {
    return executor(db);
  }

  return withTransaction(executor);
};

const mapWallet = (wallet) => ({
  id: wallet.id,
  userId: wallet.userId,
  walletType: wallet.walletType,
  asset: wallet.asset,
  totalBalance: Number(wallet.totalBalance),
  availableBalance: Number(wallet.availableBalance),
  lockedBalance: Number(wallet.lockedBalance),
  averageCost: Number(wallet.averageCost),
  custodyWalletId: wallet.custodyWalletId,
  createdAt: wallet.createdAt,
  updatedAt: wallet.updatedAt,
});

const createLedger = async ({
  userId,
  wallet,
  direction,
  amount,
  referenceType,
  referenceId,
  description,
  idempotencyKey,
  metadata,
}, db) => {
  const payload = {
    userId,
    walletId: wallet.id,
    asset: wallet.asset,
    direction,
    amount: roundAmount(amount),
    balanceAfter: roundAmount(wallet.totalBalance),
    referenceType,
    referenceId,
    description,
    idempotencyKey,
    metadata,
  };

  const entry = await ledgerEntriesRepository.create(
    {
      ...payload,
    },
    db,
  );

  await walletLedgerEntriesRepository.create(
    {
      ...payload,
      entryType: "wallet",
      status: "completed",
    },
    db,
  );

  return entry;
};

export const getUserWallets = async (userId) => {
  const wallets = await walletsRepository.findByUser(userId);
  return wallets.map(mapWallet);
};

export const findWallet = async ({ userId, walletType, asset }, db) => {
  const wallet = await walletsRepository.findByUserTypeAsset({ userId, walletType, asset }, db);
  return wallet ? mapWallet(wallet) : null;
};

export const createWalletRecord = async ({ userId, walletType, asset }) => {
  return runAtomic(null, async (db) => {
    const existing = await walletsRepository.findByUserTypeAsset({ userId, walletType, asset }, db);

    if (existing) {
      return mapWallet(existing);
    }

    const custody = await providers.custody.createWallet({ userId, walletType, asset });

    const wallet = await walletsRepository.create(
      {
        userId,
        walletType,
        asset,
        custodyWalletId: custody.custodyWalletId,
      },
      db,
    );

    await auditLogsRepository.create(
      {
        action: "wallet_created",
        actorId: userId,
        actorRole: "user",
        resourceType: "wallet",
        resourceId: wallet.id,
        metadata: {
          walletType,
          asset,
          custodyWalletId: custody.custodyWalletId,
        },
      },
      db,
    );

    return mapWallet(wallet);
  });
};

export const debitWallet = async ({ userId, walletType, asset, amount, referenceType, referenceId, description, lockOnly = false, idempotencyKey }, db) => {
  return runAtomic(db, async (tx) => {
    const wallet = await balancesRepository.lockWallet({ userId, walletType, asset }, tx);

    if (!wallet) {
      throw new Error(`Wallet not found for ${asset} (${walletType}).`);
    }

    const normalized = roundAmount(amount);
    const normalizedDecimal = toDecimal(normalized);
    const walletAvailable = toDecimal(wallet.availableBalance);

    if (walletAvailable.lessThan(normalizedDecimal)) {
      throw new Error(`Insufficient available ${asset} balance.`);
    }

    const totalBalance = lockOnly
      ? toDecimal(wallet.totalBalance)
      : toDecimal(wallet.totalBalance).minus(normalizedDecimal);
    const availableBalance = walletAvailable.minus(normalizedDecimal);
    const lockedBalance = lockOnly
      ? toDecimal(wallet.lockedBalance).plus(normalizedDecimal)
      : toDecimal(wallet.lockedBalance);

    const updated = await balancesRepository.updateWalletBalances(
      {
        walletId: wallet.id,
        totalBalance: totalBalance.toString(),
        availableBalance: availableBalance.toString(),
        lockedBalance: lockedBalance.toString(),
      },
      tx,
    );

    await createLedger(
      {
        userId,
        wallet: updated,
        direction: "debit",
        amount: normalized,
        referenceType,
        referenceId,
        description,
        idempotencyKey,
      },
      tx,
    );

    return mapWallet(updated);
  });
};

export const creditWallet = async ({ userId, walletType, asset, amount, referenceType, referenceId, description, idempotencyKey }, db) => {
  return runAtomic(db, async (tx) => {
    let wallet = await balancesRepository.lockWallet({ userId, walletType, asset }, tx);

    if (!wallet) {
      await walletsRepository.create(
        {
          userId,
          walletType,
          asset,
          metadata: {},
        },
        tx,
      );
      wallet = await balancesRepository.lockWallet({ userId, walletType, asset }, tx);
    }

    if (!wallet) {
      throw new Error(`Wallet not found for ${asset} (${walletType}).`);
    }

    const normalized = roundAmount(amount);
    const normalizedDecimal = toDecimal(normalized);

    const updated = await balancesRepository.updateWalletBalances(
      {
        walletId: wallet.id,
        totalBalance: toDecimal(wallet.totalBalance).plus(normalizedDecimal).toString(),
        availableBalance: toDecimal(wallet.availableBalance).plus(normalizedDecimal).toString(),
        lockedBalance: toDecimal(wallet.lockedBalance).toString(),
      },
      tx,
    );

    await createLedger(
      {
        userId,
        wallet: updated,
        direction: "credit",
        amount: normalized,
        referenceType,
        referenceId,
        description,
        idempotencyKey,
      },
      tx,
    );

    return mapWallet(updated);
  });
};

export const consumeLockedBalance = async ({ userId, walletType, asset, amount, referenceType, referenceId, description, idempotencyKey }, db) => {
  return runAtomic(db, async (tx) => {
    const wallet = await balancesRepository.lockWallet({ userId, walletType, asset }, tx);

    if (!wallet) {
      throw new Error(`Wallet not found for ${asset} (${walletType}).`);
    }

    const normalized = roundAmount(amount);
    const normalizedDecimal = toDecimal(normalized);
    const lockedDecimal = toDecimal(wallet.lockedBalance);

    if (lockedDecimal.lessThan(normalizedDecimal)) {
      throw new Error(`Insufficient locked ${asset} balance for settlement.`);
    }

    const updated = await balancesRepository.updateWalletBalances(
      {
        walletId: wallet.id,
        totalBalance: toDecimal(wallet.totalBalance).minus(normalizedDecimal).toString(),
        availableBalance: toDecimal(wallet.availableBalance).toString(),
        lockedBalance: lockedDecimal.minus(normalizedDecimal).toString(),
      },
      tx,
    );

    await createLedger(
      {
        userId,
        wallet: updated,
        direction: "debit",
        amount: normalized,
        referenceType,
        referenceId,
        description,
        idempotencyKey,
      },
      tx,
    );

    return mapWallet(updated);
  });
};

export const releaseLockedBalance = async ({ userId, walletType, asset, amount, referenceType, referenceId, description, idempotencyKey }, db) => {
  return runAtomic(db, async (tx) => {
    const wallet = await balancesRepository.lockWallet({ userId, walletType, asset }, tx);

    if (!wallet) {
      throw new Error(`Wallet not found for ${asset} (${walletType}).`);
    }

    const normalized = roundAmount(amount);
    const normalizedDecimal = toDecimal(normalized);
    const lockedDecimal = toDecimal(wallet.lockedBalance);
    const releaseAmount = normalizedDecimal.greaterThan(lockedDecimal) ? lockedDecimal : normalizedDecimal;

    const updated = await balancesRepository.updateWalletBalances(
      {
        walletId: wallet.id,
        totalBalance: toDecimal(wallet.totalBalance).toString(),
        availableBalance: toDecimal(wallet.availableBalance).plus(releaseAmount).toString(),
        lockedBalance: lockedDecimal.minus(releaseAmount).toString(),
      },
      tx,
    );

    await createLedger(
      {
        userId,
        wallet: updated,
        direction: "credit",
        amount: releaseAmount.toString(),
        referenceType,
        referenceId,
        description,
        idempotencyKey,
      },
      tx,
    );

    return mapWallet(updated);
  });
};

export const transferBetweenWallets = async ({ user, asset, amount, fromWalletType, toWalletType }) => {
  if (fromWalletType === toWalletType) {
    throw new Error("Source and destination wallet type must be different.");
  }

  return runAtomic(null, async (db) => {
    const transferId = uuid();
    const idempotencyKey = `wallet_transfer_${transferId}`;

    await debitWallet(
      {
        userId: user.id,
        walletType: fromWalletType,
        asset,
        amount,
        referenceType: "wallet_transfer",
        referenceId: transferId,
        description: `Transfer out to ${toWalletType}`,
        idempotencyKey,
      },
      db,
    );

    await creditWallet(
      {
        userId: user.id,
        walletType: toWalletType,
        asset,
        amount,
        referenceType: "wallet_transfer",
        referenceId: transferId,
        description: `Transfer in from ${fromWalletType}`,
        idempotencyKey,
      },
      db,
    );

    const destinationWallet = await walletsRepository.findByUserTypeAsset(
      {
        userId: user.id,
        walletType: toWalletType,
        asset,
      },
      db,
    );

    const transaction = await walletTransactionsRepository.create(
      {
        userId: user.id,
        walletId: destinationWallet?.id || null,
        transactionType: "wallet_transfer",
        asset,
        walletType: toWalletType,
        network: "internal",
        amount: roundAmount(amount),
        fee: 0,
        destinationAddress: `${fromWalletType} to ${toWalletType}`,
        status: "completed",
        riskScore: 2,
        idempotencyKey,
        metadata: {
          fromWalletType,
          toWalletType,
        },
      },
      db,
    );

    await auditLogsRepository.create(
      {
        action: "wallet_transfer_completed",
        actorId: user.id,
        actorRole: user.role,
        resourceType: "transaction",
        resourceId: transaction.id,
        metadata: {
          fromWalletType,
          toWalletType,
          asset,
          amount: transaction.amount,
        },
      },
      db,
    );

    return {
      id: transaction.id,
      type: transaction.transactionType,
      asset: transaction.asset,
      network: transaction.network,
      walletType: transaction.walletType,
      amount: Number(transaction.amount),
      fee: Number(transaction.fee),
      status: transaction.status,
      address: transaction.destinationAddress,
      riskScore: Number(transaction.riskScore),
      createdAt: transaction.createdAt,
    };
  });
};

export const getWalletBalances = async (userId) => {
  await ensureUserWalletFoundation(userId);

  const wallets = (await walletsRepository.findByUser(userId)).map(mapWallet);
  const totalBalance = wallets.reduce((sum, item) => sum + item.availableBalance * (item.averageCost || 1), 0);

  return {
    wallets,
    totalBalance: roundAmount(totalBalance, 2),
  };
};

export const createDepositAddress = async ({ userId, asset, network, walletType }) => {
  return getOrCreateDepositAddress({ userId, asset, network, walletType });
};

export const createDepositRecord = async ({ user, asset, network, amount, walletType, address }) => {
  return runAtomic(null, async (db) => {
    const resolvedWalletType = normalizeWalletType(walletType);
    const { asset: assetCode, network: networkCode } = assertSupportedAssetNetwork({ asset, network });
    const wallet = await walletsRepository.create(
      {
        userId: user.id,
        walletType: resolvedWalletType,
        asset: assetCode,
      },
      db,
    );
    const requiredConfirmations = getWalletAddressConfirmationCount({ asset: assetCode, network: networkCode });
    const idempotencyKey = `deposit_${user.id}_${assetCode}_${Date.now()}`;

    const transaction = await walletTransactionsRepository.create(
      {
        userId: user.id,
        walletId: wallet.id,
        transactionType: "deposit",
        asset: assetCode,
        walletType: resolvedWalletType,
        network: networkCode,
        amount: roundAmount(amount),
        fee: 0,
        destinationAddress: address,
        status: "pending_confirmation",
        riskScore: 5,
        idempotencyKey,
        metadata: {
          confirmationsRequired: requiredConfirmations,
        },
      },
      db,
    );

    await depositRecordsRepository.create(
      {
        userId: user.id,
        walletId: wallet.id,
        walletTransactionId: transaction.id,
        asset: assetCode,
        network: networkCode,
        walletType: resolvedWalletType,
        expectedAmount: roundAmount(amount),
        status: "pending_confirmation",
        confirmationsRequired: requiredConfirmations,
        confirmationsCount: 0,
        idempotencyKey,
        metadata: {},
      },
      db,
    );

    await auditLogsRepository.create(
      {
        action: "deposit_intent_created",
        actorId: user.id,
        actorRole: user.role,
        resourceType: "transaction",
        resourceId: transaction.id,
        metadata: {
          asset: assetCode,
          network: networkCode,
          amount: Number(transaction.amount),
          walletType: resolvedWalletType,
        },
      },
      db,
    );

    await jobQueue.publish(
      "wallet.deposit_intent.created",
      {
        userId: user.id,
        transactionId: transaction.id,
        asset: assetCode,
        network: networkCode,
        amount: Number(transaction.amount),
      },
      db,
    );

    return {
      id: transaction.id,
      type: transaction.transactionType,
      asset: transaction.asset,
      walletType: transaction.walletType,
      network: transaction.network,
      amount: Number(transaction.amount),
      fee: Number(transaction.fee),
      status: transaction.status,
      address: transaction.destinationAddress,
      riskScore: Number(transaction.riskScore),
      createdAt: transaction.createdAt,
    };
  });
};

export const createWithdrawalRecord = async ({ user, asset, network, amount, address, walletType }) => {
  return runAtomic(null, async (db) => {
    const resolvedWalletType = normalizeWalletType(walletType);
    const { asset: assetCode, network: networkCode } = assertSupportedAssetNetwork({ asset, network });
    const addressCheck = validateWalletAddress({ asset: assetCode, network: networkCode, address });
    if (!addressCheck.valid) {
      throw new Error(addressCheck.message);
    }

    const recentWithdrawals = await walletTransactionsRepository.countRecentWithdrawals(user.id, 24, db);

    const risk = await evaluateWithdrawalRisk(
      {
        user,
        amount,
        isNewDestination: true,
        recentWithdrawals,
      },
      db,
    );

    const normalizedAmount = roundAmount(amount);
    const fee = roundAmount(toDecimal(normalizedAmount).mul(toDecimal(getWithdrawalFeeRate())));
    const totalDebit = roundAmount(toDecimal(normalizedAmount).plus(toDecimal(fee)));
    const idempotencyKey = `withdraw_${user.id}_${assetCode}_${Date.now()}`;

    const wallet = await debitWallet(
      {
        userId: user.id,
        walletType: resolvedWalletType,
        asset: assetCode,
        amount: totalDebit,
        referenceType: "withdrawal_request",
        referenceId: idempotencyKey,
        description: "Withdrawal debit",
        idempotencyKey,
      },
      db,
    );

    const providerResponse = await providers.custody.requestWithdrawal({
      userId: user.id,
      asset: assetCode,
      network: networkCode,
      amount: normalizedAmount,
      address: addressCheck.address,
    });

    const transaction = await walletTransactionsRepository.create(
      {
        userId: user.id,
        walletId: wallet.id,
        transactionType: "withdrawal",
        asset: assetCode,
        walletType: resolvedWalletType,
        network: networkCode,
        amount: normalizedAmount,
        fee,
        destinationAddress: addressCheck.address,
        status: risk.requiresManualReview ? "under_review" : "queued",
        riskScore: risk.score,
        idempotencyKey,
        txHash: providerResponse.withdrawalId || null,
        providerReference: providerResponse.withdrawalId || null,
        metadata: {
          providerWithdrawalId: providerResponse.withdrawalId,
        },
      },
      db,
    );

    await withdrawalsRepository.create(
      {
        userId: user.id,
        walletTransactionId: transaction.id,
        asset: assetCode,
        network: networkCode,
        amount: normalizedAmount,
        fee,
        destinationAddress: addressCheck.address,
        providerName: providerResponse.provider,
        providerReference: providerResponse.withdrawalId,
        status: transaction.status,
        riskScore: risk.score,
        idempotencyKey,
        metadata: {},
      },
      db,
    );

    await withdrawalRequestsRepository.create(
      {
        userId: user.id,
        walletId: wallet.id,
        walletTransactionId: transaction.id,
        asset: assetCode,
        network: networkCode,
        walletType: resolvedWalletType,
        amount: normalizedAmount,
        fee,
        totalDebit,
        destinationAddress: addressCheck.address,
        providerName: providerResponse.provider,
        providerReference: providerResponse.withdrawalId,
        status: transaction.status,
        riskScore: risk.score,
        idempotencyKey,
        metadata: {},
      },
      db,
    );

    await auditLogsRepository.create(
      {
        action: "withdrawal_requested",
        actorId: user.id,
        actorRole: user.role,
        resourceType: "transaction",
        resourceId: transaction.id,
        metadata: {
          asset: assetCode,
          network: networkCode,
          amount: normalizedAmount,
          fee,
          riskScore: risk.score,
          status: transaction.status,
        },
      },
      db,
    );

    await jobQueue.publish(
      "wallet.withdrawal.requested",
      {
        userId: user.id,
        transactionId: transaction.id,
        providerReference: providerResponse.withdrawalId,
        riskScore: risk.score,
      },
      db,
    );

    return {
      id: transaction.id,
      type: transaction.transactionType,
      asset: transaction.asset,
      walletType: transaction.walletType,
      network: transaction.network,
      amount: Number(transaction.amount),
      fee: Number(transaction.fee),
      status: transaction.status,
      address: transaction.destinationAddress,
      riskScore: Number(transaction.riskScore),
      createdAt: transaction.createdAt,
    };
  });
};

export const listWalletHistory = async (userId) => {
  const items = await walletTransactionsRepository.listByUser(userId, undefined, {
    page: 1,
    pageSize: 200,
  });

  return items.map((entry) => ({
    id: entry.id,
    type: entry.transactionType,
    asset: entry.asset,
    walletType: entry.walletType,
    network: entry.network,
    amount: Number(entry.amount),
    fee: Number(entry.fee),
    status: entry.status,
    address: entry.destinationAddress,
    txHash: entry.txHash || null,
    sourceAddress: entry.sourceAddress || null,
    riskScore: Number(entry.riskScore),
    createdAt: entry.createdAt,
  }));
};

export const listLedgerEntries = async (userId, limit = 100) => {
  const rows = await walletLedgerEntriesRepository.listByUser(userId, limit);

  return rows.map((entry) => ({
    id: entry.id,
    userId: entry.userId,
    walletId: entry.walletId,
    asset: entry.asset,
    direction: entry.direction,
    amount: Number(entry.amount),
    balanceAfter: Number(entry.balanceAfter),
    referenceType: entry.referenceType,
    referenceId: entry.referenceId,
    description: entry.description,
    createdAt: entry.createdAt,
  }));
};
