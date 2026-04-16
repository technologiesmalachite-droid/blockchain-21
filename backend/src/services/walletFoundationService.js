import { withTransaction } from "../db/transaction.js";
import { walletAssetsRepository } from "../repositories/walletAssetsRepository.js";
import { walletsRepository } from "../repositories/walletsRepository.js";
import { listSupportedWalletAssets } from "./walletCatalogService.js";

const SUPPORTED_WALLET_TYPES = ["spot", "funding"];

const getSupportedAssets = async () => {
  const dbAssets = await walletAssetsRepository.listActive().catch(() => []);
  if (dbAssets.length > 0) {
    return dbAssets.map((row) => String(row.asset || "").toUpperCase()).filter(Boolean);
  }

  return listSupportedWalletAssets().map((row) => row.asset);
};

export const ensureUserWalletFoundation = async (userId) => {
  if (!userId) {
    return;
  }

  await withTransaction(async (db) => {
    await db.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`wallet_foundation:${userId}`]);

    const supportedAssets = await getSupportedAssets();
    for (const asset of supportedAssets) {
      for (const walletType of SUPPORTED_WALLET_TYPES) {
        await walletsRepository.create(
          {
            userId,
            walletType,
            asset,
            metadata: {
              seededBy: "wallet_foundation",
            },
          },
          db,
        );
      }
    }
  });
};

