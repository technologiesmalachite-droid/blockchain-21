import { z } from "zod";

const optionalString = z.string().trim().min(1).optional();
const phoneRegex = /^\+?[0-9][0-9\s-]{7,15}$/;
const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const normalizedSideSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.toLowerCase() : value),
  z.enum(["buy", "sell"]),
);
const normalizedOrderTypeSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.toLowerCase() : value),
  z.enum(["market", "limit"]),
);

export const registerSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(10),
    phone: z.string().regex(phoneRegex, "Enter a valid mobile number."),
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
    side: normalizedSideSchema,
    orderType: normalizedOrderTypeSchema,
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
    side: normalizedSideSchema,
    orderType: normalizedOrderTypeSchema,
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
    mobile: z.string().regex(phoneRegex, "Enter a valid mobile number.").optional(),
    email: z.string().email(),
    address: z.string().min(6),
    verificationMethod: z.string().min(2),
    panNumber: z.string().toUpperCase().regex(panRegex, "PAN format is invalid.").optional(),
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
    decision: z.enum(["approved", "rejected", "under_review", "needs_resubmission", "request_resubmission"]),
    note: optionalString,
    rejectionReason: optionalString,
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
}).superRefine((value, ctx) => {
  const decision = value.body.decision;
  if ((decision === "rejected" || decision === "needs_resubmission" || decision === "request_resubmission") && !value.body.rejectionReason) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["body", "rejectionReason"],
      message: "rejectionReason is required for rejected or resubmission decisions.",
    });
  }
});

export const otpCodeSchema = z.object({
  body: z.object({
    code: z.string().trim().length(6),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const firebaseSessionSchema = z.object({
  body: z.object({
    idToken: z.string().min(32),
    countryCode: z.string().length(2).toUpperCase().optional(),
    termsAccepted: z.boolean().optional(),
    privacyAccepted: z.boolean().optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const kycDocumentIdSchema = z.object({
  params: z.object({
    documentId: z.string().min(8),
  }),
  query: z.object({}).optional(),
  body: z.object({}).optional(),
});

export const kycCaseIdSchema = z.object({
  params: z.object({
    caseId: z.string().min(8),
  }),
  query: z.object({}).optional(),
  body: z.object({}).optional(),
});

export const kycProfileSubmissionSchema = z.object({
  body: z.object({
    countryCode: z.string().length(2).toUpperCase(),
    fullLegalName: z.string().min(2),
    dob: z.string().min(8),
    mobile: z.string().regex(phoneRegex, "Enter a valid mobile number."),
    email: z.string().email(),
    address: z.string().min(6),
    governmentIdType: z.string().min(2),
    panNumber: z.string().trim().toUpperCase().regex(panRegex, "PAN format is invalid."),
    addressProofProvided: z.boolean().optional(),
    useDigiLocker: z.boolean().optional(),
    consentAccepted: z.boolean(),
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
