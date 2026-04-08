import bcrypt from "bcryptjs";
import { v4 as uuid } from "uuid";

const hashPassword = (plain) => bcrypt.hashSync(plain, 10);

const now = new Date().toISOString();

export const db = {
  users: [
    {
      id: "user-demo-1",
      role: "user",
      email: "trader@malachitex.com",
      phone: "+1 415 555 0182",
      passwordHash: hashPassword("DemoTrader123!"),
      fullName: "Aarav Patel",
      country: "Singapore",
      antiPhishingCode: "MalachiteX",
      twoFactorEnabled: true,
      kycStatus: "verified",
      createdAt: now,
    },
    {
      id: "admin-demo-1",
      role: "admin",
      email: "admin@malachitex.com",
      phone: "+1 415 555 0131",
      passwordHash: hashPassword("AdminVault123!"),
      fullName: "Mira Chen",
      country: "United Arab Emirates",
      antiPhishingCode: "VAULT",
      twoFactorEnabled: true,
      kycStatus: "verified",
      createdAt: now,
    },
  ],
  refreshTokens: [],
  marketPairs: [
    { symbol: "BTCUSDT", base: "BTC", quote: "USDT", lastPrice: 68241.22, previousPrice: 67102.14, high24h: 68990.44, low24h: 66410.33, volume24h: 84215.22 },
    { symbol: "ETHUSDT", base: "ETH", quote: "USDT", lastPrice: 3528.1, previousPrice: 3440.92, high24h: 3569.18, low24h: 3398.2, volume24h: 221411.82 },
    { symbol: "SOLUSDT", base: "SOL", quote: "USDT", lastPrice: 171.55, previousPrice: 166.13, high24h: 173.2, low24h: 162.1, volume24h: 534118.54 },
    { symbol: "BNBUSDT", base: "BNB", quote: "USDT", lastPrice: 612.41, previousPrice: 620.1, high24h: 624.4, low24h: 606.92, volume24h: 88431.5 },
    { symbol: "XRPUSDT", base: "XRP", quote: "USDT", lastPrice: 0.634, previousPrice: 0.609, high24h: 0.642, low24h: 0.602, volume24h: 1425119.92 },
    { symbol: "ADAUSDT", base: "ADA", quote: "USDT", lastPrice: 0.812, previousPrice: 0.831, high24h: 0.839, low24h: 0.801, volume24h: 980124.33 },
  ],
  balances: {
    "user-demo-1": [
      { asset: "USDT", balance: 24850.12, available: 18880.12, averageCost: 1 },
      { asset: "BTC", balance: 0.8462, available: 0.7462, averageCost: 62110.4 },
      { asset: "ETH", balance: 6.182, available: 6.182, averageCost: 3194.2 },
      { asset: "SOL", balance: 122.4, available: 118.1, averageCost: 143.88 },
    ],
  },
  orders: {
    "user-demo-1": [
      { id: uuid(), symbol: "BTCUSDT", side: "buy", orderType: "limit", price: 67500, quantity: 0.12, status: "open", createdAt: now },
      { id: uuid(), symbol: "ETHUSDT", side: "sell", orderType: "limit", price: 3610, quantity: 1.5, status: "partially_filled", createdAt: now },
    ],
  },
  tradeHistory: {
    "user-demo-1": [
      { id: uuid(), symbol: "BTCUSDT", side: "buy", price: 66421.55, quantity: 0.09, fee: 2.99, time: now },
      { id: uuid(), symbol: "SOLUSDT", side: "buy", price: 160.12, quantity: 25, fee: 1.15, time: now },
    ],
  },
  transactions: {
    "user-demo-1": [
      { id: uuid(), type: "deposit", asset: "USDT", network: "TRC20", amount: 5000, fee: 0, status: "completed", address: "TQ1yDemoAddress", createdAt: now },
      { id: uuid(), type: "withdrawal", asset: "BTC", network: "Bitcoin", amount: 0.05, fee: 0.0002, status: "processing", address: "bc1qdemoaddress", createdAt: now },
      { id: uuid(), type: "transfer", asset: "USDT", network: "Internal", amount: 1000, fee: 0, status: "completed", address: "Funding to Spot", createdAt: now },
    ],
  },
  kycSubmissions: [
    { id: uuid(), userId: "user-demo-1", legalName: "Aarav Patel", nationality: "Indian", status: "verified", createdAt: now },
  ],
  supportTickets: [
    { id: uuid(), userId: "user-demo-1", subject: "Withdrawal confirmation delay", category: "Wallet", priority: "high", status: "open", message: "Please confirm whether the BTC withdrawal is awaiting review.", createdAt: now },
  ],
};
