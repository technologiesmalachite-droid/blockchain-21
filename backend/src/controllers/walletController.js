import { v4 as uuid } from "uuid";
import { db } from "../services/demoDb.js";

export const getBalances = (req, res) => {
  const balances = db.balances[req.user.id] || [];
  const totalBalance = balances.reduce((sum, item) => sum + item.available * item.averageCost, 0);
  return res.json({ balances, totalBalance });
};

export const createDepositRequest = (req, res) => {
  const record = {
    id: uuid(),
    type: "deposit",
    asset: req.validated.body.asset,
    network: req.validated.body.network,
    amount: req.validated.body.amount,
    fee: 0,
    address: "mx_demo_deposit_address",
    status: "pending",
    createdAt: new Date().toISOString(),
  };

  db.transactions[req.user.id] ||= [];
  db.transactions[req.user.id].unshift(record);
  return res.status(201).json({ record, message: "Deposit request created." });
};

export const createWithdrawRequest = (req, res) => {
  const record = {
    id: uuid(),
    type: "withdrawal",
    asset: req.validated.body.asset,
    network: req.validated.body.network,
    amount: req.validated.body.amount,
    fee: Number((req.validated.body.amount * 0.001).toFixed(6)),
    address: req.validated.body.address,
    status: "under_review",
    createdAt: new Date().toISOString(),
  };

  db.transactions[req.user.id] ||= [];
  db.transactions[req.user.id].unshift(record);
  return res.status(201).json({ record, message: "Withdrawal request received." });
};

export const getWalletHistory = (req, res) => res.json({ items: db.transactions[req.user.id] || [] });

