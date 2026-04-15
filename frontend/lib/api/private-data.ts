"use client";

import { apiRequest } from "@/lib/api/client";
import { getAccessToken } from "@/lib/auth/session-store";

export type OpenPosition = {
  id: string;
  symbol: string;
  side: "buy" | "sell";
  orderType: "market" | "limit";
  walletType: "spot" | "funding";
  price: number | null;
  quantity: number;
  filledQuantity?: number;
  remainingQuantity?: number;
  notional: number;
  fee: number;
  lockedAmount?: number;
  status: string;
  createdAt: string;
};

export type OrderBookLevel = {
  price: number;
  quantity: number;
};

export type PublicTradePrint = {
  id: string;
  matchId: string;
  side: "buy" | "sell";
  price: number;
  quantity: number;
  notional: number;
  time: string;
};

export type OrderBookSnapshot = {
  symbol: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  bestBid: number | null;
  bestAsk: number | null;
  spread: number | null;
  recentTrades: PublicTradePrint[];
  updatedAt: string;
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
  feeAsset?: string | null;
  liquidityRole?: "maker" | "taker" | null;
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

export type MarketSummary = {
  symbol: string;
  base: string;
  quote: string;
  lastPrice: number;
  previousPrice: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  minOrderSize: number;
  pricePrecision: number;
  quantityPrecision: number;
  change24h: number;
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
  requiresBack?: boolean;
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
  contacts: {
    emailVerified: boolean;
    emailVerifiedAt?: string | null;
    mobileVerified: boolean;
    mobileVerifiedAt?: string | null;
  };
  profile: {
    jurisdiction: string;
    legalName: string;
    dob: string;
    mobile?: string | null;
    email: string;
    residentialAddress: string;
    verificationMethod: string;
    idDocumentType?: string | null;
    panLast4?: string | null;
    resubmissionCount?: number;
    idNumberMasked?: string | null;
  } | null;
  latestSubmission: {
    id: string;
    status: string;
    selectedMethod: string;
    reviewerNote?: string | null;
    rejectionReason?: string | null;
    updatedAt: string;
  } | null;
  latestReview: {
    id: string;
    decision: string;
    reviewNotes?: string | null;
    rejectionReason?: string | null;
    createdAt: string;
  } | null;
  documents: Array<{
    id: string;
    documentGroup: string;
    documentSide: string;
    documentType: string;
    status: string;
    maskedIdentifier?: string | null;
    fileSizeBytes: number;
    mimeType: string;
    createdAt: string;
    reviewedAt?: string | null;
  }>;
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

export type KycQueueItem = {
  id: string;
  status: string;
  selectedMethod: string;
  riskScore: number;
  rejectionReason?: string | null;
  reviewerNote?: string | null;
  updatedAt: string;
  user?: {
    email: string;
    fullName: string;
  };
  documents: Array<{
    id: string;
    documentGroup: string;
    documentSide: string;
    documentType: string;
    status: string;
    maskedIdentifier?: string | null;
    mimeType: string;
    fileSizeBytes: number;
    createdAt: string;
  }>;
};

export const fetchOpenPositions = () =>
  apiRequest<{ items: OpenPosition[] }>("/trade/open-orders", {
    auth: "required",
  });

export const fetchUserOrders = () =>
  apiRequest<{ items: OpenPosition[] }>("/trade/orders", {
    auth: "required",
  });

export const fetchTradeOrderBook = (symbol: string, depth = 20) =>
  apiRequest<OrderBookSnapshot>(`/market/orderbook?symbol=${encodeURIComponent(symbol)}&depth=${depth}`, {
    auth: "none",
  });

export const fetchTradingPairs = () =>
  apiRequest<{ items: MarketSummary[] }>("/markets", {
    auth: "none",
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

export const sendKycEmailOtp = () =>
  apiRequest<{ message: string; challengeId: string; expiresAt: string; cooldownUntil: string; resendCount: number; debugCode?: string }>(
    "/kyc/email/send-otp",
    {
      auth: "required",
      method: "POST",
      body: {},
    },
  );

export const verifyKycEmailOtp = (code: string) =>
  apiRequest<{ message: string; status: string }>("/kyc/email/verify-otp", {
    auth: "required",
    method: "POST",
    body: { code },
  });

export const sendKycMobileOtp = () =>
  apiRequest<{ message: string; challengeId: string; expiresAt: string; cooldownUntil: string; resendCount: number; debugCode?: string }>(
    "/kyc/mobile/send-otp",
    {
      auth: "required",
      method: "POST",
      body: {},
    },
  );

export const verifyKycMobileOtp = (code: string) =>
  apiRequest<{ message: string; status: string }>("/kyc/mobile/verify-otp", {
    auth: "required",
    method: "POST",
    body: { code },
  });

export const submitKycProfileDetails = (payload: {
  countryCode: string;
  fullLegalName: string;
  dob: string;
  mobile: string;
  email: string;
  address: string;
  governmentIdType: string;
  panNumber: string;
  addressProofProvided?: boolean;
  useDigiLocker?: boolean;
  consentAccepted: boolean;
}) =>
  apiRequest<{ message: string; submission: Record<string, unknown>; panVerification: Record<string, unknown> }>("/kyc/profile", {
    auth: "required",
    method: "POST",
    body: payload,
  });

export const uploadKycDocuments = async (payload: {
  consentAccepted: boolean;
  governmentIdType: string;
  govIdFront: File;
  govIdBack?: File | null;
  panCard: File;
  selfie: File;
}) => {
  const accessToken = getAccessToken();
  if (!accessToken) {
    throw new Error("Authentication required.");
  }

  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") || "";
  if (!baseUrl) {
    throw new Error("API base URL is not configured.");
  }

  const form = new FormData();
  form.append("consentAccepted", payload.consentAccepted ? "true" : "false");
  form.append("governmentIdType", payload.governmentIdType);
  form.append("govIdFront", payload.govIdFront);
  if (payload.govIdBack) {
    form.append("govIdBack", payload.govIdBack);
  }
  form.append("panCard", payload.panCard);
  form.append("selfie", payload.selfie);

  const response = await fetch(`${baseUrl}/kyc/documents/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: form,
    credentials: "include",
  });

  if (!response.ok) {
    try {
      const payload = (await response.json()) as { message?: string };
      throw new Error(payload.message || "KYC document upload failed.");
    } catch {
      throw new Error("KYC document upload failed.");
    }
  }

  return response.json() as Promise<{ message: string; submission: Record<string, unknown> }>;
};

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
  apiRequest<{ items: KycQueueItem[] }>("/admin/kyc", {
    auth: "required",
  });

export const postKycReview = (payload: {
  submissionId: string;
  decision: "approved" | "rejected" | "under_review" | "needs_resubmission" | "request_resubmission";
  note?: string;
  rejectionReason?: string;
}) =>
  apiRequest<{ message: string }>("/admin/compliance/kyc-review", {
    auth: "required",
    method: "POST",
    body: payload,
  });

export const fetchAdminKycCaseDocuments = (caseId: string) =>
  apiRequest<{
    items: Array<{
      id: string;
      documentGroup: string;
      documentSide: string;
      documentType: string;
      status: string;
      maskedIdentifier?: string | null;
      mimeType: string;
      fileSizeBytes: number;
      createdAt: string;
      reviewedAt?: string | null;
    }>;
  }>(`/admin/kyc/${caseId}/documents`, {
    auth: "required",
  });

export const fetchAdminKycDocumentBlob = async (documentId: string) => {
  const accessToken = getAccessToken();
  if (!accessToken) {
    throw new Error("Authentication required.");
  }

  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") || "";
  if (!baseUrl) {
    throw new Error("API base URL is not configured.");
  }

  const response = await fetch(`${baseUrl}/admin/kyc/documents/${documentId}/file`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Unable to fetch KYC document preview.");
  }

  return response.blob();
};

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
