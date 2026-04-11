"use client";

import { apiRequest } from "@/lib/api/client";

export type OpenPosition = {
  id: string;
  symbol: string;
  side: "buy" | "sell";
  orderType: "market" | "limit";
  walletType: "spot" | "funding";
  price: number;
  quantity: number;
  notional: number;
  fee: number;
  status: string;
  createdAt: string;
};

export type TradeHistoryItem = {
  id: string;
  symbol: string;
  side: "buy" | "sell" | "convert";
  orderType: string;
  price: number;
  quantity: number;
  notional: number;
  fee: number;
  settlementWalletType: "spot" | "funding";
  time: string;
};

export type WalletBalance = {
  asset: string;
  walletType: "spot" | "funding";
  balance: number;
  available: number;
  locked: number;
  averageCost: number;
};

export type WalletRecord = {
  id: string;
  asset: string;
  walletType: "spot" | "funding";
  totalBalance: number;
  availableBalance: number;
  lockedBalance: number;
  averageCost: number;
};

export type WalletHistoryItem = {
  id: string;
  type: string;
  asset: string;
  walletType: "spot" | "funding";
  network: string;
  amount: number;
  fee: number;
  status: string;
  address: string;
  riskScore: number;
  createdAt: string;
};

export type LedgerEntry = {
  id: string;
  asset: string;
  direction: "debit" | "credit";
  amount: number;
  balanceAfter: number;
  referenceType: string;
  referenceId: string;
  description: string;
  createdAt: string;
};

export type ProfileResponse = {
  user: {
    id: string;
    fullName: string;
    email: string;
    phone?: string;
    countryCode?: string;
    role: string;
    status: string;
    antiPhishingCode?: string;
    twoFactorEnabled?: boolean;
    emailVerified?: boolean;
    phoneVerified?: boolean;
    kycStatus?: string;
    kycTier?: string;
    sanctionsStatus?: string;
    riskScore?: number;
  };
};

export type KycOptionMethod = {
  key: string;
  label: string;
  requiresDocument: boolean;
  digilockerSupported?: boolean;
};

export type KycOptionsResponse = {
  options: {
    countryCode: string;
    jurisdiction: string;
    requiredFields: string[];
    methods: KycOptionMethod[];
    addressProofRequired: boolean;
    nonDocumentaryVerification: boolean;
    digilockerAvailable: boolean;
    sanctionsScreening: boolean;
  };
};

export type KycStatusResponse = {
  status: string;
  tier: string;
  profile: Record<string, unknown> | null;
  latestSubmission: Record<string, unknown> | null;
  auditTrail: Array<Record<string, unknown>>;
};

export type TradeQuote = {
  symbol: string;
  side: "buy" | "sell";
  orderType: "market" | "limit";
  quantity: number;
  price: number;
  notional: number;
  fee: number;
  feeRate: number;
  settlement: {
    debitAsset: string;
    creditAsset: string;
    debitAmount: number;
    creditAmount: number;
  };
};

export type AdminOverviewResponse = {
  overview: {
    openCases: number;
    highRiskCases: number;
    pendingKyc: number;
    restrictedAccounts: number;
    avgRiskScore: number;
  };
};

export type AdminCase = {
  id: string;
  type: string;
  severity: string;
  status: string;
  riskScore: number;
  title: string;
  description: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    email: string;
    fullName: string;
  } | null;
};

export const fetchOpenPositions = () =>
  apiRequest<{ items: OpenPosition[] }>("/trade/open-orders", {
    auth: "required",
  });

export const fetchTradeHistory = () =>
  apiRequest<{ items: TradeHistoryItem[] }>("/trade/history", {
    auth: "required",
  });

export const fetchTradeQuote = (payload: {
  symbol: string;
  side: "buy" | "sell";
  orderType: "market" | "limit";
  quantity: number;
  price?: number;
}) =>
  apiRequest<{ quote: TradeQuote }>("/trade/quote", {
    auth: "required",
    method: "POST",
    body: payload,
  });

export const placeTradeOrder = (payload: {
  symbol: string;
  side: "buy" | "sell";
  orderType: "market" | "limit";
  quantity: number;
  price?: number;
  walletType?: "spot" | "funding";
}) =>
  apiRequest<{ message: string; order: OpenPosition; quote: TradeQuote }>("/trade/order", {
    auth: "required",
    method: "POST",
    body: payload,
  });

export const convertAsset = (payload: {
  fromAsset: string;
  toAsset: string;
  amount: number;
  walletType?: "spot" | "funding";
}) =>
  apiRequest<{ message: string; trade: TradeHistoryItem }>("/trade/convert", {
    auth: "required",
    method: "POST",
    body: payload,
  });

export const cancelTradeOrder = (orderId: string) =>
  apiRequest<{ message: string }>(`/trade/order/${orderId}`, {
    auth: "required",
    method: "DELETE",
  });

export const fetchWalletBalances = () =>
  apiRequest<{ balances: WalletBalance[]; wallets: WalletRecord[]; totalBalance: number }>("/wallet/balances", {
    auth: "required",
  });

export const fetchWallets = () =>
  apiRequest<{ items: WalletRecord[] }>("/wallet/wallets", {
    auth: "required",
  });

export const createWalletRecord = (payload: { walletType: "spot" | "funding"; asset: string }) =>
  apiRequest<{ message: string; wallet: WalletRecord }>("/wallet/wallets", {
    auth: "required",
    method: "POST",
    body: payload,
  });

export const transferWalletFunds = (payload: {
  asset: string;
  amount: number;
  fromWalletType: "spot" | "funding";
  toWalletType: "spot" | "funding";
}) =>
  apiRequest<{ message: string }>("/wallet/transfer", {
    auth: "required",
    method: "POST",
    body: payload,
  });

export const requestDepositAddress = (payload: { asset: string; network: string; walletType: "spot" | "funding" }) =>
  apiRequest<{ address: string; memo?: string; expiresAt?: string }>("/wallet/deposit-address", {
    auth: "required",
    method: "POST",
    body: payload,
  });

export const fetchWalletHistory = () =>
  apiRequest<{ items: WalletHistoryItem[] }>("/wallet/history", {
    auth: "required",
  });

export const fetchWalletLedger = () =>
  apiRequest<{ items: LedgerEntry[] }>("/wallet/ledger", {
    auth: "required",
  });

export const fetchProfile = () =>
  apiRequest<ProfileResponse>("/user/profile", {
    auth: "required",
  });

export const createDepositRequest = (payload: { asset: string; network: string; amount: number; walletType: "spot" | "funding"; address?: string }) =>
  apiRequest<{ message: string }>("/wallet/deposit-request", {
    auth: "required",
    method: "POST",
    body: payload,
  });

export const createWithdrawRequest = (payload: {
  asset: string;
  network: string;
  amount: number;
  address: string;
  walletType: "spot" | "funding";
  twoFactorCode: string;
}) =>
  apiRequest<{ message: string }>("/wallet/withdraw-request", {
    auth: "required",
    method: "POST",
    body: payload,
  });

export const fetchKycOptions = (countryCode: string) =>
  apiRequest<KycOptionsResponse>(`/kyc/options/${countryCode}`, {
    auth: "required",
  });

export const submitKycApplication = (payload: {
  countryCode: string;
  fullLegalName: string;
  dob: string;
  mobile?: string;
  email: string;
  address: string;
  verificationMethod: string;
  idNumber?: string;
  selfieProvided: boolean;
  documentProvided: boolean;
  addressProofProvided?: boolean;
  useDigiLocker?: boolean;
  consentAccepted: boolean;
}) =>
  apiRequest<{ message: string; submission: Record<string, unknown> }>("/kyc/submit", {
    auth: "required",
    method: "POST",
    body: payload,
  });

export const fetchKycStatus = () =>
  apiRequest<KycStatusResponse>("/kyc/status", {
    auth: "required",
  });

export const fetchAdminAnalytics = () =>
  apiRequest<{ metrics: Record<string, number>; feeMix: Array<{ label: string; value: number }> }>("/admin/analytics", {
    auth: "required",
  });

export const fetchComplianceOverview = () =>
  apiRequest<AdminOverviewResponse>("/admin/compliance/overview", {
    auth: "required",
  });

export const fetchComplianceCases = () =>
  apiRequest<{ items: AdminCase[] }>("/admin/compliance/cases", {
    auth: "required",
  });

export const fetchKycQueue = () =>
  apiRequest<{ items: Array<Record<string, unknown>> }>("/admin/kyc", {
    auth: "required",
  });

export const postKycReview = (payload: { submissionId: string; decision: "approved" | "rejected" | "under_review"; note?: string }) =>
  apiRequest<{ message: string }>("/admin/compliance/kyc-review", {
    auth: "required",
    method: "POST",
    body: payload,
  });

export const postAccountRestrictions = (payload: {
  userId: string;
  frozen?: boolean;
  withdrawalsLocked?: boolean;
  tradingLocked?: boolean;
  note?: string;
}) =>
  apiRequest<{ message: string }>("/admin/compliance/account-restrictions", {
    auth: "required",
    method: "POST",
    body: payload,
  });

export const resolveComplianceCase = (caseId: string, resolution: string) =>
  apiRequest<{ message: string }>(`/admin/compliance/cases/${caseId}/resolve`, {
    auth: "required",
    method: "POST",
    body: { resolution },
  });

export const fetchAdminAuditLogs = () =>
  apiRequest<{ items: Array<Record<string, unknown>> }>("/admin/audit-logs", {
    auth: "required",
  });

export const createPaymentIntent = (payload: {
  direction: "onramp" | "offramp";
  amount: number;
  fiatCurrency: string;
  asset: string;
  paymentMethod: string;
}) =>
  apiRequest<{ intent: Record<string, unknown> }>("/payments/intents", {
    auth: "required",
    method: "POST",
    body: payload,
  });

export const fetchPaymentIntents = () =>
  apiRequest<{ items: Array<Record<string, unknown>> }>("/payments/intents", {
    auth: "required",
  });
