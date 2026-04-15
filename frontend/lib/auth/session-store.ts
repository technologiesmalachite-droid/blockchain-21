"use client";

export type AccountRestrictions = {
  frozen: boolean;
  withdrawalsLocked: boolean;
  tradingLocked: boolean;
};

export type AuthUser = {
  id: string;
  role: string;
  status: string;
  email: string;
  authProvider?: string;
  phone?: string;
  fullName: string;
  countryCode?: string;
  antiPhishingCode?: string;
  twoFactorEnabled?: boolean;
  emailVerified?: boolean;
  emailVerifiedAt?: string;
  phoneVerified?: boolean;
  phoneVerifiedAt?: string;
  kycStatus?: string;
  kycTier?: string;
  sanctionsStatus?: string;
  riskScore?: number;
  accountRestrictions?: AccountRestrictions;
  termsAcceptedAt?: string;
  privacyAcceptedAt?: string;
  createdAt?: string;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export type AuthSession = {
  user: AuthUser;
  tokens: AuthTokens;
};

export const AUTH_SESSION_STORAGE_KEY = "malachitex.auth.session.v1";
export const AUTH_COOKIE_NAME = "mx_access_token";
export const SESSION_CHANGED_EVENT = "malachitex:auth-session-changed";
export const AUTH_REQUIRED_EVENT = "malachitex:auth-required";

const ACCESS_COOKIE_TTL_SECONDS = 60 * 60 * 24 * 7;

const isBrowser = () => typeof window !== "undefined";

const writeAccessCookie = (token: string) => {
  if (!isBrowser()) {
    return;
  }

  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; Max-Age=${ACCESS_COOKIE_TTL_SECONDS}; SameSite=Lax${secure}`;
};

const clearAccessCookie = () => {
  if (!isBrowser()) {
    return;
  }

  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${AUTH_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
};

const emitSessionChanged = (session: AuthSession | null) => {
  if (!isBrowser()) {
    return;
  }

  window.dispatchEvent(new CustomEvent<AuthSession | null>(SESSION_CHANGED_EVENT, { detail: session }));
};

export const emitAuthRequired = (message = "Authentication required. Please sign in to continue.") => {
  if (!isBrowser()) {
    return;
  }

  window.dispatchEvent(new CustomEvent<string>(AUTH_REQUIRED_EVENT, { detail: message }));
};

export const readSession = (): AuthSession | null => {
  if (!isBrowser()) {
    return null;
  }

  const raw = window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
    clearAccessCookie();
    return null;
  }
};

export const saveSession = (session: AuthSession) => {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session));
  writeAccessCookie(session.tokens.accessToken);
  emitSessionChanged(session);
};

export const updateAccessToken = (accessToken: string): AuthSession | null => {
  const current = readSession();

  if (!current) {
    return null;
  }

  const nextSession: AuthSession = {
    ...current,
    tokens: {
      ...current.tokens,
      accessToken,
    },
  };

  saveSession(nextSession);
  return nextSession;
};

export const clearSession = () => {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
  clearAccessCookie();
  emitSessionChanged(null);
};

export const getAccessToken = () => readSession()?.tokens.accessToken ?? null;
export const getRefreshToken = () => readSession()?.tokens.refreshToken ?? null;
