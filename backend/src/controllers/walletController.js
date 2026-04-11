import {
  createDepositAddress,
  createDepositRecord,
  createWalletRecord,
  createWithdrawalRecord,
  getUserWallets,
  getWalletBalances,
  listLedgerEntries,
  listWalletHistory,
  transferBetweenWallets,
} from "../services/walletEngine.js";

export const getBalances = async (req, res) => {
  const { wallets, totalBalance } = await getWalletBalances(req.user.id);

  const balances = wallets.map((wallet) => ({
    asset: wallet.asset,
    walletType: wallet.walletType,
    balance: wallet.totalBalance,
    available: wallet.availableBalance,
    locked: wallet.lockedBalance,
    averageCost: wallet.averageCost,
  }));

  return res.json({
    wallets,
    balances,
    totalBalance,
  });
};

export const getWallets = async (req, res) => {
  const wallets = await getUserWallets(req.user.id);
  return res.json({ items: wallets });
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
    return res.status(400).json({ message: error.message });
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
    return res.status(400).json({ message: error.message });
  }
};

export const generateDepositAddress = async (req, res) => {
  try {
    const record = await createDepositAddress({
      userId: req.user.id,
      asset: req.validated.body.asset,
      network: req.validated.body.network,
      walletType: req.validated.body.walletType,
    });

    return res.status(201).json({
      address: record.address,
      memo: record.memo,
      network: record.network,
      asset: record.asset,
      walletType: record.walletType,
      expiresAt: record.expiresAt,
    });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

export const createDepositRequest = async (req, res) => {
  try {
    const record = await createDepositRecord({
      user: req.user,
      asset: req.validated.body.asset,
      network: req.validated.body.network,
      amount: req.validated.body.amount,
      walletType: req.validated.body.walletType,
      address: req.validated.body.address || "pending_custody_assignment",
    });

    return res.status(201).json({ record, message: "Deposit request created." });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

export const createWithdrawRequest = async (req, res) => {
  try {
    const record = await createWithdrawalRecord({
      user: req.user,
      asset: req.validated.body.asset,
      network: req.validated.body.network,
      amount: req.validated.body.amount,
      address: req.validated.body.address,
      walletType: req.validated.body.walletType,
    });

    return res.status(201).json({ record, message: "Withdrawal request received." });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

export const getWalletHistory = async (req, res) => res.json({ items: await listWalletHistory(req.user.id) });

export const getLedgerHistory = async (req, res) => res.json({ items: await listLedgerEntries(req.user.id, 100) });
