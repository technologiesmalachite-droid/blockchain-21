import bcrypt from "bcryptjs";
import { v4 as uuid } from "uuid";
import { db } from "./demoDb.js";

export const sanitizeUser = (user) => ({
  id: user.id,
  role: user.role,
  email: user.email,
  phone: user.phone,
  fullName: user.fullName,
  country: user.country,
  antiPhishingCode: user.antiPhishingCode,
  twoFactorEnabled: user.twoFactorEnabled,
  kycStatus: user.kycStatus,
  createdAt: user.createdAt,
});

export const createUser = async ({ email, password, phone, fullName }) => {
  const existing = db.users.find((user) => user.email === email);
  if (existing) {
    throw new Error("An account with this email already exists.");
  }

  const user = {
    id: uuid(),
    role: "user",
    email,
    phone: phone || "",
    passwordHash: await bcrypt.hash(password, 10),
    fullName,
    country: "United States",
    antiPhishingCode: "",
    twoFactorEnabled: false,
    kycStatus: "pending",
    createdAt: new Date().toISOString(),
  };

  db.users.push(user);
  db.balances[user.id] = [{ asset: "USDT", balance: 10000, available: 10000, averageCost: 1 }];
  db.orders[user.id] = [];
  db.tradeHistory[user.id] = [];
  db.transactions[user.id] = [];
  return user;
};

export const authenticateUser = async ({ email, password }) => {
  const user = db.users.find((entry) => entry.email === email);

  if (!user) {
    throw new Error("Invalid credentials.");
  }

  const valid = await bcrypt.compare(password, user.passwordHash);

  if (!valid) {
    throw new Error("Invalid credentials.");
  }

  return user;
};

