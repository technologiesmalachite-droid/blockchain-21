import { z } from "zod";

export const registerSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(8),
    phone: z.string().min(8).optional(),
    fullName: z.string().min(2),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(8),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const orderSchema = z.object({
  body: z.object({
    symbol: z.string().min(6),
    side: z.enum(["buy", "sell"]),
    orderType: z.enum(["market", "limit", "stop-limit"]),
    price: z.number().optional(),
    quantity: z.number().positive(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const profileSchema = z.object({
  body: z.object({
    fullName: z.string().min(2),
    country: z.string().min(2),
    antiPhishingCode: z.string().max(20).optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const walletRequestSchema = z.object({
  body: z.object({
    asset: z.string().min(2),
    network: z.string().min(2),
    amount: z.number().positive(),
    address: z.string().optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const kycSchema = z.object({
  body: z.object({
    legalName: z.string().min(2),
    dob: z.string().min(4),
    nationality: z.string().min(2),
    addressLine: z.string().min(6),
    idType: z.string().min(2),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const supportSchema = z.object({
  body: z.object({
    subject: z.string().min(3),
    category: z.string().min(2),
    priority: z.string().min(2),
    message: z.string().min(10),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

