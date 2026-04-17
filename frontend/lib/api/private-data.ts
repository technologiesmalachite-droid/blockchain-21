"use client";

import { ApiRequestError, apiRequest } from "@/lib/api/client";
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
  sourceAddress?: string | null;
  txHash?: string | null;
  providerReference?: string | null;
  failureReason?: string | null;
  riskScore: number;
  createdAt: string;
  completedAt?: string | null;
  cancelledAt?: string | null;
};

export type WalletSummary = {
  totalPortfolioBalance: number;
  assets: Array<{
    asset: string;
    totalBalance: number;
    availableBalance: number;
    lockedBalance: number;
    usdPrice: number;
    fiatEquivalent: number;
    wallets: WalletRecord[];
  }>;
  supportedAssets: Array<{
    asset: string;
    displayName: string;
    precision: number;
    networks: string[];
  }>;
};

export type WalletAssetDetail = {
  asset: string;
  displayName: string;
  precision: number;
  networks: string[];
  walletType?: "spot" | "funding" | null;
  totals: {
    totalBalance: number;
    availableBalance: number;
    lockedBalance: number;
  };
  wallets: WalletRecord[];
  addresses: Array<{
    id: string;
    network: string;
    walletType: "spot" | "funding";
    address: string;
    memo?: string | null;
    status: string;
    expiresAt?: string | null;
    createdAt: string;
  }>;
  recentTransactions: WalletHistoryItem[];
};

export type WalletTransactionsResponse = {
  items: WalletHistoryItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  filters: Record<string, unknown>;
};

export type WalletDepositAddress = {
  id?: string;
  address: string;
  memo?: string | null;
  network: string;
  asset: string;
  walletType: "spot" | "funding";
  expiresAt?: string | null;
  memoRequired?: boolean;
  warnings?: string[];
  qrCodeDataUrl?: string;
};

export type WalletWithdrawalFeeEstimate = {
  asset: string;
  network: string;
  amount: number;
  feeRate: number;
  feeAmount: number;
  totalDebit: number;
  warnings: string[];
};

export type WalletSwapQuote = {
  quoteId: string;
  walletType: "spot" | "funding";
  fromAsset: string;
  toAsset: string;
  fromAmount: number;
  toAmount: number;
  rate: number;
  feeAmount: number;
  feeRateBps: number;
  slippageBps: number;
  status: string;
  quoteExpiresAt: string;
  createdAt: string;
};

export type WalletSwapResult = WalletSwapQuote & {
  transactionId: string;
  txHash: string;
  conversionId: string;
  tradeId: string;
  completedAt: string;
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
    twoFactorEnabledAt?: string;
    twoFactorRecoveryCodesRemaining?: number;
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

export const fetchWalletSummary = () =>
  apiRequest<WalletSummary>("/wallet/summary", {
    auth: "required",
  });

export const fetchWalletAssetDetail = (asset: string, walletType?: "spot" | "funding") =>
  apiRequest<WalletAssetDetail>(`/wallet/assets/${encodeURIComponent(asset)}${walletType ? `?walletType=${walletType}` : ""}`, {
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
  apiRequest<WalletDepositAddress>("/wallet/address/generate", {
    auth: "required",
    method: "POST",
    body: payload,
  });

export const fetchWalletAddresses = (asset: string, walletType?: "spot" | "funding") =>
  apiRequest<{ items: WalletDepositAddress[] }>(`/wallet/addresses?asset=${encodeURIComponent(asset)}${walletType ? `&walletType=${walletType}` : ""}`, {
    auth: "required",
  });

export const fetchWalletHistory = (params?: {
  page?: number;
  pageSize?: number;
  asset?: string;
  walletType?: "spot" | "funding";
  type?: string;
  status?: string;
  network?: string;
  search?: string;
}) => {
  const search = new URLSearchParams();
  if (params?.page) search.set("page", String(params.page));
  if (params?.pageSize) search.set("pageSize", String(params.pageSize));
  if (params?.asset) search.set("asset", params.asset);
  if (params?.walletType) search.set("walletType", params.walletType);
  if (params?.type) search.set("type", params.type);
  if (params?.status) search.set("status", params.status);
  if (params?.network) search.set("network", params.network);
  if (params?.search) search.set("search", params.search);

  return apiRequest<WalletTransactionsResponse>(`/wallet/transactions${search.toString() ? `?${search.toString()}` : ""}`, {
    auth: "required",
  });
};

export type NotificationItem = {
  id: string;
  category: string;
  severity: "info" | "success" | "warning" | "critical";
  title: string;
  message: string;
  actionUrl?: string | null;
  metadata: Record<string, unknown>;
  readAt?: string | null;
  createdAt: string;
};

export type NotificationListResponse = {
  items: NotificationItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  unreadCount: number;
};

export type SupportTicket = {
  id: string;
  subject: string;
  category: string;
  priority: "low" | "normal" | "high" | "urgent";
  status: string;
  message: string;
  createdAt: string;
  updatedAt: string;
};

export const fetchWalletTransactionById = (id: string) =>
  apiRequest<{ transaction: WalletHistoryItem }>(`/wallet/transactions/${encodeURIComponent(id)}`, {
    auth: "required",
  });

export const fetchWalletTransactionByHash = (hash: string) =>
  apiRequest<{ transaction: WalletHistoryItem }>(`/wallet/transactions/hash/${encodeURIComponent(hash)}`, {
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

export const updateProfile = (payload: {
  fullName: string;
  countryCode: string;
  antiPhishingCode?: string;
}) =>
  apiRequest<ProfileResponse & { message: string }>("/user/profile", {
    auth: "required",
    method: "PUT",
    body: payload,
  });

export const createDepositRequest = (payload: { asset: string; network: string; amount: number; walletType: "spot" | "funding"; address?: string }) =>
  apiRequest<{ message: string; record: WalletHistoryItem }>("/wallet/deposit-request", {
    auth: "required",
    method: "POST",
    body: payload,
  });

export const estimateWithdrawFee = (payload: {
  asset: string;
  network: string;
  amount: number;
  walletType: "spot" | "funding";
}) =>
  apiRequest<{ estimate: WalletWithdrawalFeeEstimate }>("/wallet/withdraw-estimate", {
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
  apiRequest<{ message: string; record: WalletHistoryItem & { feePreview?: WalletWithdrawalFeeEstimate } }>("/wallet/withdraw-request", {
    auth: "required",
    method: "POST",
    body: payload,
  });

export const createWalletSwapQuote = (payload: {
  fromAsset: string;
  toAsset: string;
  amount: number;
  walletType?: "spot" | "funding";
  slippageBps?: number;
}) =>
  apiRequest<{ message: string; quote: WalletSwapQuote }>("/wallet/swap/quote", {
    auth: "required",
    method: "POST",
    body: payload,
  });

export const confirmWalletSwap = (payload: { quoteId: string }) =>
  apiRequest<{ message: string; swap: WalletSwapResult }>("/wallet/swap/confirm", {
    auth: "required",
    method: "POST",
    body: payload,
  });

export const fetchKycOptions = (countryCode: string) =>
  apiRequest<KycOptionsResponse>(`/kyc/options/${countryCode}`, {
    auth: "required",
  });

export const sendKycEmailOtp = async () => {
  try {
    const response = await apiRequest<{
      message: string;
      challengeId: string;
      expiresAt: string;
      cooldownUntil: string;
      resendCount: number;
      debugCode?: string;
    }>("/kyc/email/send-otp", {
      auth: "required",
      method: "POST",
      body: {},
    });

    if (process.env.NODE_ENV !== "production") {
      console.info("[kyc-email-otp-send] response", {
        status: 200,
        body: response,
      });
    }

    return response;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      if (error instanceof ApiRequestError) {
        console.error("[kyc-email-otp-send] response", {
          status: error.status,
          body: error.responseBody ?? { message: error.message },
          code: error.code,
        });
      } else {
        console.error("[kyc-email-otp-send] response", {
          status: 0,
          body: { message: error instanceof Error ? error.message : "Unknown error" },
        });
      }
    }

    throw error;
  }
};

export const verifyKycEmailOtp = (code: string) =>
  apiRequest<{ message: string; status: string }>("/kyc/email/verify-otp", {
    auth: "required",
    method: "POST",
    body: { code },
  });

export const sendKycMobileOtp = async (mobile?: string) => {
  try {
    const response = await apiRequest<{
      message: string;
      challengeId: string;
      expiresAt: string;
      cooldownUntil: string;
      resendCount: number;
      debugCode?: string;
    }>("/kyc/mobile/send-otp", {
      auth: "required",
      method: "POST",
      body: mobile ? { mobile } : {},
    });

    if (process.env.NODE_ENV !== "production") {
      console.info("[kyc-mobile-otp-send] response", {
        status: 200,
        body: response,
      });
    }

    return response;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      if (error instanceof ApiRequestError) {
        console.error("[kyc-mobile-otp-send] response", {
          status: error.status,
          body: error.responseBody ?? { message: error.message },
          code: error.code,
        });
      } else {
        console.error("[kyc-mobile-otp-send] response", {
          status: 0,
          body: { message: error instanceof Error ? error.message : "Unknown error" },
        });
      }
    }

    throw error;
  }
};

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

  const headers: HeadersInit = {};
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${baseUrl}/kyc/documents/upload`, {
    method: "POST",
    headers,
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

  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") || "";
  if (!baseUrl) {
    throw new Error("API base URL is not configured.");
  }

  const headers: HeadersInit = {};
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${baseUrl}/admin/kyc/documents/${documentId}/file`, {
    method: "GET",
    headers,
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

export const fetchNotifications = (params?: { page?: number; pageSize?: number; unreadOnly?: boolean }) => {
  const search = new URLSearchParams();
  if (params?.page) search.set("page", String(params.page));
  if (params?.pageSize) search.set("pageSize", String(params.pageSize));
  if (params?.unreadOnly !== undefined) search.set("unreadOnly", params.unreadOnly ? "true" : "false");

  return apiRequest<NotificationListResponse>(`/notifications${search.toString() ? `?${search.toString()}` : ""}`, {
    auth: "required",
  });
};

export const markNotificationRead = (id: string) =>
  apiRequest<{ message: string; notification: NotificationItem }>(`/notifications/${encodeURIComponent(id)}/read`, {
    auth: "required",
    method: "POST",
    body: {},
  });

export const markAllNotificationsRead = () =>
  apiRequest<{ message: string }>("/notifications/read-all", {
    auth: "required",
    method: "POST",
    body: {},
  });

export const fetchSupportTickets = () =>
  apiRequest<{ items: SupportTicket[] }>("/support", {
    auth: "required",
  });

export const createSupportTicket = (payload: {
  subject: string;
  category: string;
  priority: "low" | "normal" | "high" | "urgent";
  message: string;
}) =>
  apiRequest<{ message: string; ticket: SupportTicket }>("/support", {
    auth: "required",
    method: "POST",
    body: payload,
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

export type P2PPaymentMethod = {
  id: string;
  methodType: "bank_transfer" | "upi" | "manual";
  label: string;
  accountName: string;
  accountNumberMasked?: string | null;
  upiIdMasked?: string | null;
  metadata?: Record<string, unknown>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type P2POffer = {
  id: string;
  advertiser: {
    userId: string;
    nickname: string;
    completionRate: number | null;
    totalTrades: number;
  };
  tradeType: "buy" | "sell";
  takerSide: "buy" | "sell";
  assetCode: string;
  fiatCurrency: string;
  walletType: "spot" | "funding";
  priceType: "fixed";
  price: number;
  totalQuantity: number;
  remainingQuantity: number;
  minAmount: number;
  maxAmount: number;
  terms?: string | null;
  status: string;
  autoCancelMinutes: number;
  paymentMethods: Array<{
    id: string;
    type: string;
    label: string;
    accountName?: string;
    accountNumberMasked?: string;
    upiIdMasked?: string;
  }>;
  createdAt: string;
  updatedAt: string;
};

export type P2POrderMessage = {
  id: string;
  orderId: string;
  senderUserId?: string | null;
  senderNickname?: string | null;
  messageType: "SYSTEM" | "USER";
  body: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type P2PDispute = {
  id: string;
  orderId: string;
  openedByUserId: string;
  status: string;
  reason: string;
  resolutionNotes?: string | null;
  internalNotes?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type P2POrder = {
  id: string;
  offerId: string;
  offerTradeType: "buy" | "sell";
  role: "buyer" | "seller";
  counterparty: {
    id: string;
    nickname: string;
  };
  buyerUserId: string;
  sellerUserId: string;
  assetCode: string;
  fiatCurrency: string;
  walletType: "spot" | "funding";
  unitPrice: number;
  cryptoAmount: number;
  fiatAmount: number;
  status: "PENDING_PAYMENT" | "PAID" | "RELEASED" | "CANCELLED" | "DISPUTED" | "EXPIRED";
  expiresAt: string;
  markedPaidAt?: string | null;
  releasedAt?: string | null;
  cancelledAt?: string | null;
  disputeOpenedAt?: string | null;
  cancelReason?: string | null;
  paymentMethod?: {
    id: string;
    type: string;
    label: string;
    accountName?: string | null;
    accountNumberMasked?: string | null;
    upiIdMasked?: string | null;
    metadata?: Record<string, unknown>;
  } | null;
  offerTerms?: string | null;
  offerPaymentMethods?: Array<Record<string, unknown>>;
  messages?: P2POrderMessage[];
  dispute?: P2PDispute | null;
  createdAt: string;
  updatedAt: string;
};

export type P2PMarketplaceResponse = {
  items: P2POffer[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  filters: {
    side: "buy" | "sell";
    assetCode?: string | null;
    fiatCurrency?: string | null;
    paymentMethodType?: string | null;
  };
};

export const fetchP2pConfig = () =>
  apiRequest<{
    config: {
      assets: string[];
      fiatCurrencies: string[];
      paymentMethodTypes: string[];
      orderStatuses: string[];
    };
  }>("/p2p/config", {
    auth: "required",
  });

export const fetchP2pMarketplaceOffers = (params?: {
  side?: "buy" | "sell";
  assetCode?: string;
  fiatCurrency?: string;
  paymentMethodType?: "bank_transfer" | "upi" | "manual";
  page?: number;
  pageSize?: number;
}) => {
  const search = new URLSearchParams();
  if (params?.side) search.set("side", params.side);
  if (params?.assetCode) search.set("assetCode", params.assetCode);
  if (params?.fiatCurrency) search.set("fiatCurrency", params.fiatCurrency);
  if (params?.paymentMethodType) search.set("paymentMethodType", params.paymentMethodType);
  if (params?.page) search.set("page", String(params.page));
  if (params?.pageSize) search.set("pageSize", String(params.pageSize));

  return apiRequest<P2PMarketplaceResponse>(`/p2p/marketplace/offers${search.toString() ? `?${search.toString()}` : ""}`, {
    auth: "required",
  });
};

export const fetchMyP2pOffers = () =>
  apiRequest<{ items: P2POffer[] }>("/p2p/offers/mine", {
    auth: "required",
  });

export const createP2pOffer = (payload: {
  tradeType: "buy" | "sell";
  assetCode: string;
  fiatCurrency: string;
  walletType?: "spot" | "funding";
  pricingType?: "fixed";
  price: number;
  totalQuantity: number;
  minAmount: number;
  maxAmount: number;
  paymentMethodIds: string[];
  terms?: string;
  autoCancelMinutes?: number;
}) =>
  apiRequest<{ message: string; offer: P2POffer }>("/p2p/offers", {
    auth: "required",
    method: "POST",
    body: payload,
  });

export const fetchP2pOffer = (offerId: string) =>
  apiRequest<{ offer: P2POffer }>(`/p2p/offers/${encodeURIComponent(offerId)}`, {
    auth: "required",
  });

export const updateP2pOfferStatus = (offerId: string, status: "ACTIVE" | "PAUSED" | "CLOSED" | "CANCELLED") =>
  apiRequest<{ message: string; offer: P2POffer }>(`/p2p/offers/${encodeURIComponent(offerId)}/status`, {
    auth: "required",
    method: "PATCH",
    body: { status },
  });

export const fetchP2pPaymentMethods = (includeInactive = false) =>
  apiRequest<{ items: P2PPaymentMethod[] }>(`/p2p/payment-methods${includeInactive ? "?includeInactive=true" : ""}`, {
    auth: "required",
  });

export const createP2pPaymentMethod = (payload: {
  methodType: "bank_transfer" | "upi" | "manual";
  label: string;
  accountName: string;
  accountNumber?: string;
  upiId?: string;
  metadata?: Record<string, unknown>;
}) =>
  apiRequest<{ message: string; method: P2PPaymentMethod }>("/p2p/payment-methods", {
    auth: "required",
    method: "POST",
    body: payload,
  });

export const updateP2pPaymentMethod = (
  methodId: string,
  payload: {
    methodType?: "bank_transfer" | "upi" | "manual";
    label?: string;
    accountName?: string;
    accountNumber?: string;
    upiId?: string;
    isActive?: boolean;
    metadata?: Record<string, unknown>;
  },
) =>
  apiRequest<{ message: string; method: P2PPaymentMethod }>(`/p2p/payment-methods/${encodeURIComponent(methodId)}`, {
    auth: "required",
    method: "PUT",
    body: payload,
  });

export const deleteP2pPaymentMethod = (methodId: string) =>
  apiRequest<{ message: string; method: P2PPaymentMethod }>(`/p2p/payment-methods/${encodeURIComponent(methodId)}`, {
    auth: "required",
    method: "DELETE",
  });

export const createP2pOrder = (offerId: string, payload: { fiatAmount: number; paymentMethodId?: string }) =>
  apiRequest<{ message: string; order: P2POrder }>(`/p2p/offers/${encodeURIComponent(offerId)}/orders`, {
    auth: "required",
    method: "POST",
    body: payload,
  });

export const fetchP2pOrders = (params?: { status?: P2POrder["status"]; page?: number; pageSize?: number }) => {
  const search = new URLSearchParams();
  if (params?.status) search.set("status", params.status);
  if (params?.page) search.set("page", String(params.page));
  if (params?.pageSize) search.set("pageSize", String(params.pageSize));

  return apiRequest<{
    items: P2POrder[];
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
  }>(`/p2p/orders${search.toString() ? `?${search.toString()}` : ""}`, {
    auth: "required",
  });
};

export const fetchP2pOrder = (orderId: string) =>
  apiRequest<{ order: P2POrder }>(`/p2p/orders/${encodeURIComponent(orderId)}`, {
    auth: "required",
  });

export const markP2pOrderPaid = (orderId: string) =>
  apiRequest<{ message: string; order: P2POrder }>(`/p2p/orders/${encodeURIComponent(orderId)}/mark-paid`, {
    auth: "required",
    method: "POST",
    body: {},
  });

export const releaseP2pOrder = (orderId: string) =>
  apiRequest<{ message: string; order: P2POrder }>(`/p2p/orders/${encodeURIComponent(orderId)}/release`, {
    auth: "required",
    method: "POST",
    body: {},
  });

export const cancelP2pOrder = (orderId: string, reason?: string) =>
  apiRequest<{ message: string; order: P2POrder }>(`/p2p/orders/${encodeURIComponent(orderId)}/cancel`, {
    auth: "required",
    method: "POST",
    body: reason ? { reason } : {},
  });

export const openP2pDispute = (orderId: string, reason: string) =>
  apiRequest<{ message: string; order: P2POrder }>(`/p2p/orders/${encodeURIComponent(orderId)}/dispute`, {
    auth: "required",
    method: "POST",
    body: { reason },
  });

export const fetchP2pOrderMessages = (orderId: string) =>
  apiRequest<{ items: P2POrderMessage[] }>(`/p2p/orders/${encodeURIComponent(orderId)}/messages`, {
    auth: "required",
  });

export const sendP2pOrderMessage = (orderId: string, body: string) =>
  apiRequest<{ message: string; item: P2POrderMessage }>(`/p2p/orders/${encodeURIComponent(orderId)}/messages`, {
    auth: "required",
    method: "POST",
    body: { body },
  });
