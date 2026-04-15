import { env } from "../config/env.js";
import { walletTransactionsRepository } from "../repositories/walletTransactionsRepository.js";

const toNumber = (value) => Number(value || 0);

const normalizeFilters = (filters = {}) => {
  const page = Math.max(1, Number(filters.page || 1));
  const configuredDefault = Math.max(1, Number(env.walletHistoryDefaultPageSize || 25));
  const configuredMax = Math.max(configuredDefault, Number(env.walletHistoryMaxPageSize || 100));
  const requestedPageSize = Number(filters.pageSize || configuredDefault);
  const pageSize = Math.max(1, Math.min(configuredMax, requestedPageSize));

  return {
    page,
    pageSize,
    type: filters.type ? String(filters.type).trim().toLowerCase() : undefined,
    status: filters.status ? String(filters.status).trim().toLowerCase() : undefined,
    asset: filters.asset ? String(filters.asset).trim().toUpperCase() : undefined,
    network: filters.network ? String(filters.network).trim().toUpperCase() : undefined,
    walletType: filters.walletType ? String(filters.walletType).trim().toLowerCase() : undefined,
    search: filters.search ? String(filters.search).trim() : undefined,
  };
};

const mapTransaction = (entry) => ({
  id: entry.id,
  type: entry.transactionType,
  asset: entry.asset,
  walletType: entry.walletType,
  network: entry.network,
  amount: toNumber(entry.amount),
  fee: toNumber(entry.fee),
  status: entry.status,
  address: entry.destinationAddress,
  sourceAddress: entry.sourceAddress || null,
  txHash: entry.txHash || null,
  providerReference: entry.providerReference || null,
  failureReason: entry.failureReason || null,
  riskScore: Number(entry.riskScore || 0),
  createdAt: entry.createdAt,
  completedAt: entry.completedAt || null,
  cancelledAt: entry.cancelledAt || null,
});

export const listWalletTransactions = async ({ userId, filters }) => {
  const normalized = normalizeFilters(filters);
  const [items, total] = await Promise.all([
    walletTransactionsRepository.listByUser(userId, undefined, normalized),
    walletTransactionsRepository.countByUser(userId, undefined, normalized),
  ]);

  return {
    items: items.map(mapTransaction),
    pagination: {
      page: normalized.page,
      pageSize: normalized.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / normalized.pageSize)),
    },
    filters: normalized,
  };
};

export const getWalletTransactionById = async ({ userId, transactionId }) => {
  const transaction = await walletTransactionsRepository.findByIdForUser({ userId, transactionId });
  if (!transaction) {
    throw new Error("Transaction not found.");
  }

  return mapTransaction(transaction);
};

export const getWalletTransactionByHash = async ({ userId, txHash }) => {
  const transaction = await walletTransactionsRepository.findByHashForUser({ userId, txHash });
  if (!transaction) {
    throw new Error("Transaction hash not found.");
  }

  return mapTransaction(transaction);
};
