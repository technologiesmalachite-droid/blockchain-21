import { db } from "../services/demoDb.js";

export const getAdminUsers = (_req, res) =>
  res.json({
    items: db.users.map((user) => ({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      kycStatus: user.kycStatus,
      createdAt: user.createdAt,
    })),
  });

export const getAdminKyc = (_req, res) => res.json({ items: db.kycSubmissions });

export const getAdminTransactions = (_req, res) =>
  res.json({ items: Object.values(db.transactions).flat().sort((a, b) => b.createdAt.localeCompare(a.createdAt)) });

export const getAdminAnalytics = (_req, res) =>
  res.json({
    metrics: {
      activeUsers24h: 14288,
      tradingVolume24h: 482000000,
      platformFees24h: 621830,
      flaggedAccounts: 17,
      ticketsOpen: db.supportTickets.filter((ticket) => ticket.status === "open").length,
    },
    feeMix: [
      { label: "Spot", value: 54 },
      { label: "Futures", value: 23 },
      { label: "Earn", value: 11 },
      { label: "Withdrawal", value: 12 },
    ],
  });

