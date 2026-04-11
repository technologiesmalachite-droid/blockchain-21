import { v4 as uuid } from "uuid";
import { withTransaction } from "../db/transaction.js";
import { auditLogsRepository } from "../repositories/auditLogsRepository.js";
import { balancesRepository } from "../repositories/balancesRepository.js";
import { depositAddressesRepository } from "../repositories/depositAddressesRepository.js";
import { ledgerEntriesRepository } from "../repositories/ledgerEntriesRepository.js";
import { walletTransactionsRepository } from "../repositories/walletTransactionsRepository.js";
import { walletsRepository } from "../repositories/walletsRepository.js";
import { withdrawalsRepository } from "../repositories/withdrawalsRepository.js";
import { evaluateWithdrawalRisk } from "./complianceService.js";
import { providers } from "./providerRegistry.js";
import { jobQueue } from "../workers/jobQueue.js";

const roundAmount = (value, precision = 10) => Number(Number(value).toFixed(precision));

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
  return ledgerEntriesRepository.create(
    {
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
    },
    db,
  );
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

    if (Number(wallet.availableBalance) < normalized) {
      throw new Error(`Insufficient available ${asset} balance.`);
    }

    const totalBalance = lockOnly ? Number(wallet.totalBalance) : roundAmount(Number(wallet.totalBalance) - normalized);
    const availableBalance = roundAmount(Number(wallet.availableBalance) - normalized);
    const lockedBalance = lockOnly ? roundAmount(Number(wallet.lockedBalance) + normalized) : Number(wallet.lockedBalance);

    const updated = await balancesRepository.updateWalletBalances(
      {
        walletId: wallet.id,
        totalBalance,
        availableBalance,
        lockedBalance,
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
    const wallet = await balancesRepository.lockWallet({ userId, walletType, asset }, tx);

    if (!wallet) {
      throw new Error(`Wallet not found for ${asset} (${walletType}).`);
    }

    const normalized = roundAmount(amount);

    const updated = await balancesRepository.updateWalletBalances(
      {
        walletId: wallet.id,
        totalBalance: roundAmount(Number(wallet.totalBalance) + normalized),
        availableBalance: roundAmount(Number(wallet.availableBalance) + normalized),
        lockedBalance: Number(wallet.lockedBalance),
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

export const releaseLockedBalance = async ({ userId, walletType, asset, amount, referenceType, referenceId, description, idempotencyKey }, db) => {
  return runAtomic(db, async (tx) => {
    const wallet = await balancesRepository.lockWallet({ userId, walletType, asset }, tx);

    if (!wallet) {
      throw new Error(`Wallet not found for ${asset} (${walletType}).`);
    }

    const normalized = roundAmount(amount);

    const updated = await balancesRepository.updateWalletBalances(
      {
        walletId: wallet.id,
        totalBalance: Number(wallet.totalBalance),
        availableBalance: roundAmount(Number(wallet.availableBalance) + normalized),
        lockedBalance: Math.max(0, roundAmount(Number(wallet.lockedBalance) - normalized)),
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
  const wallets = (await walletsRepository.findByUser(userId)).map(mapWallet);
  const totalBalance = wallets.reduce((sum, item) => sum + item.availableBalance * (item.averageCost || 1), 0);

  return {
    wallets,
    totalBalance: roundAmount(totalBalance, 2),
  };
};

export const createDepositAddress = async ({ userId, asset, network, walletType }) => {
  return runAtomic(null, async (db) => {
    const wallet = await walletsRepository.create(
      {
        userId,
        walletType,
        asset,
      },
      db,
    );

    const response = await providers.custody.createDepositAddress({
      userId,
      walletId: wallet.id,
      asset,
      network,
      walletType,
    });

    return depositAddressesRepository.create(
      {
        userId,
        walletId: wallet.id,
        asset,
        network,
        walletType,
        address: response.address,
        memo: response.memo,
        providerName: response.provider,
        providerReference: response.requestId,
        expiresAt: response.expiresAt,
        idempotencyKey: `deposit_address_${wallet.id}_${network}_${Date.now()}`,
        metadata: {},
      },
      db,
    );
  });
};

export const createDepositRecord = async ({ user, asset, network, amount, walletType, address }) => {
  return runAtomic(null, async (db) => {
    const wallet = await walletsRepository.findByUserTypeAsset({ userId: user.id, walletType, asset }, db);

    const transaction = await walletTransactionsRepository.create(
      {
        userId: user.id,
        walletId: wallet?.id || null,
        transactionType: "deposit",
        asset,
        walletType,
        network,
        amount: roundAmount(amount),
        fee: 0,
        destinationAddress: address,
        status: "pending_confirmation",
        riskScore: 5,
        idempotencyKey: `deposit_${user.id}_${asset}_${Date.now()}`,
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
          asset,
          network,
          amount: Number(transaction.amount),
          walletType,
        },
      },
      db,
    );

    await jobQueue.publish(
      "wallet.deposit_intent.created",
      {
        userId: user.id,
        transactionId: transaction.id,
        asset,
        network,
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
    const fee = roundAmount(normalizedAmount * 0.001);
    const idempotencyKey = `withdraw_${user.id}_${asset}_${Date.now()}`;

    const wallet = await debitWallet(
      {
        userId: user.id,
        walletType,
        asset,
        amount: normalizedAmount + fee,
        referenceType: "withdrawal_request",
        referenceId: idempotencyKey,
        description: "Withdrawal debit",
        idempotencyKey,
      },
      db,
    );

    const providerResponse = await providers.custody.requestWithdrawal({
      userId: user.id,
      asset,
      network,
      amount: normalizedAmount,
      address,
    });

    const transaction = await walletTransactionsRepository.create(
      {
        userId: user.id,
        walletId: wallet.id,
        transactionType: "withdrawal",
        asset,
        walletType,
        network,
        amount: normalizedAmount,
        fee,
        destinationAddress: address,
        status: risk.requiresManualReview ? "under_review" : "queued",
        riskScore: risk.score,
        idempotencyKey,
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
        asset,
        network,
        amount: normalizedAmount,
        fee,
        destinationAddress: address,
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
          asset,
          network,
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
  const items = await walletTransactionsRepository.listByUser(userId);

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
    riskScore: Number(entry.riskScore),
    createdAt: entry.createdAt,
  }));
};

export const listLedgerEntries = async (userId, limit = 100) => {
  const rows = await ledgerEntriesRepository.listByUser(userId, limit);

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
