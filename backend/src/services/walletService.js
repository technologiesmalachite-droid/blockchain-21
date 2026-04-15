import { marketsRepository } from "../repositories/marketsRepository.js";
import { walletAssetsRepository } from "../repositories/walletAssetsRepository.js";
import { walletAddressesRepository } from "../repositories/walletAddressesRepository.js";
import { walletTransactionsRepository } from "../repositories/walletTransactionsRepository.js";
import { walletsRepository } from "../repositories/walletsRepository.js";
import { toDecimal, toNumber } from "../utils/decimal.js";
import {
  assertSupportedAsset,
  getWalletAssetDefinition,
  listSupportedWalletAssets,
  normalizeAssetCode,
} from "./walletCatalogService.js";

const roundAmount = (value, precision = 10) => toNumber(value, precision);

const mapWallet = (wallet) => ({
  id: wallet.id,
  asset: wallet.asset,
  walletType: wallet.walletType,
  totalBalance: Number(wallet.totalBalance || 0),
  availableBalance: Number(wallet.availableBalance || 0),
  lockedBalance: Number(wallet.lockedBalance || 0),
  averageCost: Number(wallet.averageCost || 0),
  createdAt: wallet.createdAt,
  updatedAt: wallet.updatedAt,
});

const resolveAssetUsdPrice = (asset, marketMap) => {
  if (asset === "USDT" || asset === "USDC") {
    return 1;
  }

  const direct = marketMap.get(`${asset}USDT`);
  if (direct && Number(direct.lastPrice) > 0) {
    return Number(direct.lastPrice);
  }

  const inverse = marketMap.get(`USDT${asset}`);
  if (inverse && Number(inverse.lastPrice) > 0) {
    return roundAmount(toDecimal(1).div(toDecimal(inverse.lastPrice)), 10);
  }

  return 0;
};

export const getWalletSummary = async (userId) => {
  const [walletRows, marketRows, dbAssets] = await Promise.all([
    walletsRepository.findByUser(userId),
    marketsRepository.list(),
    walletAssetsRepository.listActive().catch(() => []),
  ]);

  const marketMap = new Map(marketRows.map((market) => [market.symbol, market]));
  const grouped = new Map();

  for (const wallet of walletRows) {
    const asset = String(wallet.asset || "").toUpperCase();
    const current = grouped.get(asset) || {
      asset,
      totalBalance: 0,
      availableBalance: 0,
      lockedBalance: 0,
      wallets: [],
    };

    const mapped = mapWallet(wallet);
    current.totalBalance = roundAmount(toDecimal(current.totalBalance).plus(mapped.totalBalance));
    current.availableBalance = roundAmount(toDecimal(current.availableBalance).plus(mapped.availableBalance));
    current.lockedBalance = roundAmount(toDecimal(current.lockedBalance).plus(mapped.lockedBalance));
    current.wallets.push(mapped);
    grouped.set(asset, current);
  }

  const items = [...grouped.values()].map((assetBalance) => {
    const usdPrice = resolveAssetUsdPrice(assetBalance.asset, marketMap);
    const fiatEquivalent = roundAmount(toDecimal(assetBalance.totalBalance).mul(toDecimal(usdPrice)), 2);

    return {
      ...assetBalance,
      usdPrice,
      fiatEquivalent,
    };
  });

  const totalPortfolioBalance = items.reduce((sum, item) => sum + item.fiatEquivalent, 0);

  return {
    totalPortfolioBalance: roundAmount(totalPortfolioBalance, 2),
    assets: items.sort((a, b) => b.fiatEquivalent - a.fiatEquivalent),
    supportedAssets: (dbAssets.length ? dbAssets.map((row) => ({
      asset: row.asset,
      displayName: row.displayName,
      precision: Number(row.precision || 8),
      networks: Array.isArray(row.metadata?.networks) ? row.metadata.networks : [],
    })) : listSupportedWalletAssets()),
  };
};

export const getWalletAssetDetail = async ({ userId, asset, walletType }) => {
  const { asset: assetCode } = assertSupportedAsset(asset);
  const [wallets, addresses, history] = await Promise.all([
    walletsRepository.findByUser(userId),
    walletAddressesRepository.listByUserAsset({ userId, asset: assetCode, walletType, limit: 25 }),
    walletTransactionsRepository.listByUser(userId, undefined, {
      asset: assetCode,
      walletType,
      page: 1,
      pageSize: 50,
    }),
  ]);

  const matchingWallets = wallets.filter((row) => normalizeAssetCode(row.asset) === assetCode && (!walletType || row.walletType === walletType));
  const totals = matchingWallets.reduce(
    (accumulator, wallet) => {
      accumulator.totalBalance = roundAmount(toDecimal(accumulator.totalBalance).plus(wallet.totalBalance || 0));
      accumulator.availableBalance = roundAmount(toDecimal(accumulator.availableBalance).plus(wallet.availableBalance || 0));
      accumulator.lockedBalance = roundAmount(toDecimal(accumulator.lockedBalance).plus(wallet.lockedBalance || 0));
      return accumulator;
    },
    { totalBalance: 0, availableBalance: 0, lockedBalance: 0 },
  );

  const definition = getWalletAssetDefinition(assetCode);

  return {
    asset: assetCode,
    displayName: definition?.displayName || assetCode,
    precision: definition?.precision || 8,
    networks: definition ? Object.keys(definition.networks) : [],
    walletType: walletType || null,
    totals,
    wallets: matchingWallets.map(mapWallet),
    addresses: addresses.map((item) => ({
      id: item.id,
      network: item.network,
      walletType: item.walletType,
      address: item.address,
      memo: item.memo || null,
      status: item.status,
      expiresAt: item.expiresAt || null,
      createdAt: item.createdAt,
    })),
    recentTransactions: history.map((tx) => ({
      id: tx.id,
      type: tx.transactionType,
      amount: Number(tx.amount),
      fee: Number(tx.fee),
      status: tx.status,
      network: tx.network,
      walletType: tx.walletType,
      txHash: tx.txHash || null,
      createdAt: tx.createdAt,
    })),
  };
};
