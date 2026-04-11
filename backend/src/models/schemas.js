import { z } from "zod";

const optionalString = z.string().trim().min(1).optional();

export const registerSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(10),
    phone: z.string().min(8),
    fullName: z.string().min(2),
    countryCode: z.string().length(2).toUpperCase(),
    termsAccepted: z.boolean(),
    privacyAccepted: z.boolean(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(8),
    twoFactorCode: z.string().min(6).max(8).optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const verifyContactSchema = z.object({
  body: z.object({
    channel: z.enum(["email", "phone"]),
    code: z.string().length(6),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const sendVerificationSchema = z.object({
  body: z.object({
    channel: z.enum(["email", "phone"]),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const twoFactorSetupSchema = z.object({
  body: z.object({
    enable: z.boolean(),
    backupCode: z.string().length(6).optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const orderSchema = z.object({
  body: z.object({
    symbol: z.string().min(6),
    side: z.enum(["buy", "sell"]),
    orderType: z.enum(["market", "limit"]),
    price: z.number().positive().optional(),
    quantity: z.number().positive(),
    walletType: z.enum(["spot", "funding"]).optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const quoteSchema = z.object({
  body: z.object({
    symbol: z.string().min(6),
    side: z.enum(["buy", "sell"]),
    orderType: z.enum(["market", "limit"]),
    quantity: z.number().positive(),
    price: z.number().positive().optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const convertSchema = z.object({
  body: z.object({
    fromAsset: z.string().min(2),
    toAsset: z.string().min(2),
    amount: z.number().positive(),
    walletType: z.enum(["spot", "funding"]).optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const profileSchema = z.object({
  body: z.object({
    fullName: z.string().min(2),
    countryCode: z.string().length(2).toUpperCase(),
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
    walletType: z.enum(["spot", "funding"]).default("funding"),
    address: optionalString,
    twoFactorCode: z.string().length(6).optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const walletCreateSchema = z.object({
  body: z.object({
    walletType: z.enum(["spot", "funding"]),
    asset: z.string().min(2),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const walletTransferSchema = z.object({
  body: z.object({
    asset: z.string().min(2),
    amount: z.number().positive(),
    fromWalletType: z.enum(["spot", "funding"]),
    toWalletType: z.enum(["spot", "funding"]),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const depositAddressSchema = z.object({
  body: z.object({
    asset: z.string().min(2),
    network: z.string().min(2),
    walletType: z.enum(["spot", "funding"]).default("funding"),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const kycOptionsSchema = z.object({
  params: z.object({
    countryCode: z.string().length(2),
  }),
  query: z.object({}).optional(),
  body: z.object({}).optional(),
});

export const kycSchema = z.object({
  body: z.object({
    countryCode: z.string().length(2).toUpperCase(),
    fullLegalName: z.string().min(2),
    dob: z.string().min(8),
    mobile: z.string().min(8).optional(),
    email: z.string().email(),
    address: z.string().min(6),
    verificationMethod: z.string().min(2),
    idNumber: optionalString,
    selfieProvided: z.boolean(),
    documentProvided: z.boolean(),
    addressProofProvided: z.boolean().optional(),
    useDigiLocker: z.boolean().optional(),
    consentAccepted: z.boolean(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const kycReviewSchema = z.object({
  body: z.object({
    submissionId: z.string().min(8),
    decision: z.enum(["approved", "rejected", "under_review"]),
    note: optionalString,
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const supportSchema = z.object({
  body: z.object({
    subject: z.string().min(3),
    category: z.string().min(2),
    priority: z.enum(["low", "normal", "high", "urgent"]),
    message: z.string().min(10),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const paymentIntentSchema = z.object({
  body: z.object({
    direction: z.enum(["onramp", "offramp"]),
    amount: z.number().positive(),
    fiatCurrency: z.string().min(3).max(3).toUpperCase(),
    asset: z.string().min(2),
    paymentMethod: z.string().min(2),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const paymentWebhookSchema = z.object({
  body: z.object({
    eventId: z.string().optional(),
    eventType: z.string(),
    status: z.string().optional(),
    providerReference: z.string().optional(),
    payload: z.record(z.any()).optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const accountRestrictionSchema = z.object({
  body: z.object({
    userId: z.string().min(8),
    frozen: z.boolean().optional(),
    withdrawalsLocked: z.boolean().optional(),
    tradingLocked: z.boolean().optional(),
    note: optionalString,
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});
