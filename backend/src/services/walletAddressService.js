import { withTransaction } from "../db/transaction.js";
import { auditLogsRepository } from "../repositories/auditLogsRepository.js";
import { depositAddressesRepository } from "../repositories/depositAddressesRepository.js";
import { walletAddressesRepository } from "../repositories/walletAddressesRepository.js";
import { walletsRepository } from "../repositories/walletsRepository.js";
import { providers } from "./providerRegistry.js";
import {
  assertSupportedAsset,
  assertSupportedAssetNetwork,
  getWalletNetworkWarnings,
  normalizeWalletType,
} from "./walletCatalogService.js";

const mapAddressRecord = (record, warnings = [], memoRequired = false) => ({
  id: record.id,
  asset: record.asset,
  network: record.network,
  walletType: record.walletType,
  address: record.address,
  memo: record.memo || null,
  memoRequired,
  warnings,
  status: record.status || "active",
  expiresAt: record.expiresAt || null,
  createdAt: record.createdAt,
});

const ensureWallet = async ({ userId, walletType, asset }, db) => {
  const existing = await walletsRepository.findByUserTypeAsset({ userId, walletType, asset }, db);
  if (existing) {
    return existing;
  }

  const custody = await providers.custody.createWallet({ userId, walletType, asset });

  return walletsRepository.create(
    {
      userId,
      walletType,
      asset,
      custodyWalletId: custody.custodyWalletId,
      metadata: {
        provider: custody.provider,
      },
    },
    db,
  );
};

export const getOrCreateDepositAddress = async ({ userId, asset, network, walletType = "funding" }) => {
  const resolvedWalletType = normalizeWalletType(walletType);
  const { asset: assetCode, network: networkCode, networkDefinition } = assertSupportedAssetNetwork({ asset, network });

  return withTransaction(async (db) => {
    const wallet = await ensureWallet({ userId, walletType: resolvedWalletType, asset: assetCode }, db);

    const existing = await walletAddressesRepository.findActive(
      {
        userId,
        asset: assetCode,
        network: networkCode,
        walletType: resolvedWalletType,
      },
      db,
    );

    if (existing) {
      return mapAddressRecord(existing, getWalletNetworkWarnings({ asset: assetCode, network: networkCode }), Boolean(networkDefinition.memoRequired));
    }

    const providerResponse = await providers.custody.createDepositAddress({
      userId,
      walletId: wallet.id,
      asset: assetCode,
      network: networkCode,
      walletType: resolvedWalletType,
    });

    const idempotencyKey = `wallet_address_${userId}_${assetCode}_${networkCode}_${Date.now()}`;

    const sharedPayload = {
      userId,
      walletId: wallet.id,
      asset: assetCode,
      network: networkCode,
      walletType: resolvedWalletType,
      address: providerResponse.address,
      memo: providerResponse.memo || null,
      providerName: providerResponse.provider,
      providerReference: providerResponse.requestId,
      expiresAt: providerResponse.expiresAt || null,
      idempotencyKey,
      metadata: {
        providerPayload: providerResponse,
      },
    };

    const record = await walletAddressesRepository.create(sharedPayload, db);
    await depositAddressesRepository.create(sharedPayload, db);

    await auditLogsRepository.create(
      {
        action: "wallet_deposit_address_generated",
        actorId: userId,
        actorRole: "user",
        resourceType: "wallet_address",
        resourceId: record.id,
        metadata: {
          asset: assetCode,
          network: networkCode,
          walletType: resolvedWalletType,
          providerReference: providerResponse.requestId,
        },
      },
      db,
    );

    return mapAddressRecord(record, getWalletNetworkWarnings({ asset: assetCode, network: networkCode }), Boolean(networkDefinition.memoRequired));
  });
};

export const getWalletAddressBook = async ({ userId, asset, walletType }) => {
  const { asset: assetCode } = assertSupportedAsset(asset);
  const records = await walletAddressesRepository.listByUserAsset({ userId, asset: assetCode, walletType: walletType ? normalizeWalletType(walletType) : undefined, limit: 50 });
  return records.map((record) => mapAddressRecord(record));
};

export const createAddressQrcodePayload = (record) => {
  const uri = `${record.asset}:${record.address}`;

  if (record.memo) {
    return `${uri}?memo=${encodeURIComponent(record.memo)}`;
  }

  return uri;
};
