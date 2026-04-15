import { env } from "../config/env.js";

const ETH_LIKE_ADDRESS = /^0x[a-fA-F0-9]{40}$/;
const BTC_ADDRESS = /^(bc1|[13])[a-km-zA-HJ-NP-Z1-9]{25,62}$/;
const BCH_ADDRESS = /^(bitcoincash:)?(q|p)[a-z0-9]{41}$/i;
const LTC_ADDRESS = /^(ltc1|[LM3])[a-km-zA-HJ-NP-Z1-9]{26,62}$/;
const SOL_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const TON_ADDRESS = /^(EQ|UQ|kQ|0Q)[A-Za-z0-9_-]{46}$/;
const TRON_ADDRESS = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
const GENERIC_ADDRESS = /^[A-Za-z0-9:_-]{16,128}$/;

const registry = {
  BTC: {
    displayName: "Bitcoin",
    precision: 8,
    networks: {
      BTC: {
        addressRegex: BTC_ADDRESS,
        memoRequired: false,
        confirmations: 2,
      },
    },
  },
  ETH: {
    displayName: "Ethereum",
    precision: 8,
    networks: {
      ERC20: {
        addressRegex: ETH_LIKE_ADDRESS,
        memoRequired: false,
        confirmations: 12,
      },
    },
  },
  BNB: {
    displayName: "BNB",
    precision: 8,
    networks: {
      BEP20: {
        addressRegex: ETH_LIKE_ADDRESS,
        memoRequired: false,
        confirmations: 15,
      },
    },
  },
  BCH: {
    displayName: "Bitcoin Cash",
    precision: 8,
    networks: {
      BCH: {
        addressRegex: BCH_ADDRESS,
        memoRequired: false,
        confirmations: 2,
      },
    },
  },
  LTC: {
    displayName: "Litecoin",
    precision: 8,
    networks: {
      LTC: {
        addressRegex: LTC_ADDRESS,
        memoRequired: false,
        confirmations: 6,
      },
    },
  },
  SOL: {
    displayName: "Solana",
    precision: 8,
    networks: {
      SOL: {
        addressRegex: SOL_ADDRESS,
        memoRequired: false,
        confirmations: 32,
      },
    },
  },
  TON: {
    displayName: "Toncoin",
    precision: 8,
    networks: {
      TON: {
        addressRegex: TON_ADDRESS,
        memoRequired: false,
        confirmations: 1,
      },
    },
  },
  TRON: {
    displayName: "TRON",
    precision: 6,
    networks: {
      TRON: {
        addressRegex: TRON_ADDRESS,
        memoRequired: false,
        confirmations: 20,
      },
    },
  },
  USDC: {
    displayName: "USD Coin",
    precision: 6,
    networks: {
      ERC20: {
        addressRegex: ETH_LIKE_ADDRESS,
        memoRequired: false,
        confirmations: 12,
      },
      SOL: {
        addressRegex: SOL_ADDRESS,
        memoRequired: false,
        confirmations: 32,
      },
      TRC20: {
        addressRegex: TRON_ADDRESS,
        memoRequired: false,
        confirmations: 20,
      },
    },
  },
  USDT: {
    displayName: "Tether",
    precision: 6,
    networks: {
      ERC20: {
        addressRegex: ETH_LIKE_ADDRESS,
        memoRequired: false,
        confirmations: 12,
      },
      TRC20: {
        addressRegex: TRON_ADDRESS,
        memoRequired: false,
        confirmations: 20,
      },
      BEP20: {
        addressRegex: ETH_LIKE_ADDRESS,
        memoRequired: false,
        confirmations: 15,
      },
    },
  },
};

const upper = (value) => String(value || "").trim().toUpperCase();

export const normalizeAssetCode = (value) => upper(value);
export const normalizeNetworkCode = (value) => upper(value);
export const normalizeWalletType = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "funding" ? "funding" : "spot";
};

export const listSupportedWalletAssets = () =>
  Object.entries(registry).map(([asset, definition]) => ({
    asset,
    displayName: definition.displayName,
    precision: definition.precision,
    networks: Object.keys(definition.networks),
  }));

export const getWalletAssetDefinition = (asset) => {
  return registry[normalizeAssetCode(asset)] || null;
};

export const getWalletNetworkDefinition = (asset, network) => {
  const assetDef = getWalletAssetDefinition(asset);
  if (!assetDef) {
    return null;
  }

  return assetDef.networks[normalizeNetworkCode(network)] || null;
};

export const assertSupportedAsset = (asset) => {
  const assetCode = normalizeAssetCode(asset);
  const definition = getWalletAssetDefinition(assetCode);

  if (!definition) {
    throw new Error(`Unsupported asset: ${assetCode}.`);
  }

  return {
    asset: assetCode,
    definition,
  };
};

export const assertSupportedAssetNetwork = ({ asset, network }) => {
  const { asset: assetCode, definition } = assertSupportedAsset(asset);
  const networkCode = normalizeNetworkCode(network);
  const networkDefinition = definition.networks[networkCode];

  if (!networkDefinition) {
    throw new Error(`${assetCode} does not support the selected ${networkCode} network.`);
  }

  return {
    asset: assetCode,
    network: networkCode,
    assetDefinition: definition,
    networkDefinition,
  };
};

export const validateWalletAddress = ({ asset, network, address }) => {
  const normalizedAddress = String(address || "").trim();
  if (!normalizedAddress) {
    return { valid: false, message: "Destination address is required." };
  }

  const networkDefinition = getWalletNetworkDefinition(asset, network);
  const regex = networkDefinition?.addressRegex || GENERIC_ADDRESS;

  if (!regex.test(normalizedAddress)) {
    return { valid: false, message: `Destination address format is invalid for ${normalizeAssetCode(asset)} on ${normalizeNetworkCode(network)}.` };
  }

  return { valid: true, address: normalizedAddress };
};

export const getWalletNetworkWarnings = ({ asset, network }) => {
  const { asset: assetCode, network: networkCode, networkDefinition } = assertSupportedAssetNetwork({ asset, network });
  const warnings = [`Send only ${assetCode} via the ${networkCode} network to this address.`];

  if (networkDefinition.memoRequired) {
    warnings.push(`A destination memo/tag is required for ${assetCode} on ${networkCode}.`);
  }

  return warnings;
};

export const getWalletAddressConfirmationCount = ({ asset, network }) => {
  const networkDefinition = getWalletNetworkDefinition(asset, network);
  return Number(networkDefinition?.confirmations || 1);
};

export const getSwapFeeRate = () => Number(env.walletSwapFeeBps || 0) / 10000;

export const getWithdrawalFeeRate = () => Number(env.walletWithdrawalFeeBps || 0) / 10000;

export const getSwapQuoteExpiryMs = () => Number(env.walletSwapQuoteTtlSeconds || 60) * 1000;
