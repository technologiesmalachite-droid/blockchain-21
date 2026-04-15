import { toDecimal, toNumber } from "../utils/decimal.js";
import { createDepositRecord, createWithdrawalRecord } from "./walletEngine.js";
import {
  assertSupportedAssetNetwork,
  getWalletAddressConfirmationCount,
  getWalletNetworkWarnings,
  getWithdrawalFeeRate,
  normalizeWalletType,
  validateWalletAddress,
} from "./walletCatalogService.js";

const roundAmount = (value, precision = 10) => toNumber(value, precision);

export const estimateWithdrawalFee = ({ asset, network, amount }) => {
  const { asset: assetCode, network: networkCode } = assertSupportedAssetNetwork({ asset, network });
  const normalizedAmount = roundAmount(amount);

  if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
    throw new Error("Amount must be greater than zero.");
  }

  const feeRate = toDecimal(getWithdrawalFeeRate());
  const feeAmount = roundAmount(toDecimal(normalizedAmount).mul(feeRate));
  const totalDebit = roundAmount(toDecimal(normalizedAmount).plus(toDecimal(feeAmount)));

  return {
    asset: assetCode,
    network: networkCode,
    amount: normalizedAmount,
    feeRate: Number(feeRate),
    feeAmount,
    totalDebit,
    warnings: getWalletNetworkWarnings({ asset: assetCode, network: networkCode }),
  };
};

export const submitDepositIntent = async ({ user, asset, network, amount, walletType, address }) => {
  const resolvedWalletType = normalizeWalletType(walletType);
  const { asset: assetCode, network: networkCode } = assertSupportedAssetNetwork({ asset, network });

  return createDepositRecord({
    user,
    asset: assetCode,
    network: networkCode,
    amount,
    walletType: resolvedWalletType,
    address,
  });
};

export const submitWithdrawalIntent = async ({ user, asset, network, amount, address, walletType }) => {
  const resolvedWalletType = normalizeWalletType(walletType);
  const { asset: assetCode, network: networkCode } = assertSupportedAssetNetwork({ asset, network });

  const addressCheck = validateWalletAddress({ asset: assetCode, network: networkCode, address });
  if (!addressCheck.valid) {
    throw new Error(addressCheck.message);
  }

  const feePreview = estimateWithdrawalFee({
    asset: assetCode,
    network: networkCode,
    amount,
  });

  const result = await createWithdrawalRecord({
    user,
    asset: assetCode,
    network: networkCode,
    amount: feePreview.amount,
    address: addressCheck.address,
    walletType: resolvedWalletType,
  });

  return {
    ...result,
    expectedConfirmations: getWalletAddressConfirmationCount({ asset: assetCode, network: networkCode }),
    feePreview,
  };
};

const notConfiguredError = (message) => {
  const error = new Error(message);
  error.statusCode = 501;
  return error;
};

export const createBuyCryptoIntent = async () => {
  throw notConfiguredError("Buy crypto integration is not configured yet. Connect an on-ramp provider in payments settings.");
};

export const createSellCryptoIntent = async () => {
  throw notConfiguredError("Sell crypto integration is not configured yet. Connect a liquidity/off-ramp provider.");
};

export const createCashOutIntent = async () => {
  throw notConfiguredError("Cash-out integration is not configured yet. Configure a fiat payout provider.");
};
