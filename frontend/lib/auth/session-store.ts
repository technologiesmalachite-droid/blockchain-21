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
  twoFactorEnabledAt?: string;
  twoFactorRecoveryCodesRemaining?: number;
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

const readCookieValue = (name: string) => {
  if (!isBrowser()) {
    return null;
  }

  const encodedName = `${encodeURIComponent(name)}=`;
  const parts = document.cookie.split(";");

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed.startsWith(encodedName)) {
      continue;
    }

    const value = trimmed.slice(encodedName.length);
    if (!value) {
      return null;
    }

    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  return null;
};

const readAccessTokenCookie = () => {
  const token = readCookieValue(AUTH_COOKIE_NAME);
  return token && token.trim() ? token.trim() : null;
};

const asString = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const normalizeStoredSession = (stored: unknown): AuthSession | null => {
  if (!isObjectRecord(stored)) {
    return null;
  }

  const user = isObjectRecord(stored.user) ? stored.user : null;
  if (!user) {
    return null;
  }

  const userId = asString(user.id);
  const userEmail = asString(user.email);
  const userFullName = asString(user.fullName);

  if (!userId || !userEmail || !userFullName) {
    return null;
  }

  const tokens = isObjectRecord(stored.tokens) ? stored.tokens : null;
  const accessToken =
    asString(tokens?.accessToken) ||
    asString(stored.accessToken) ||
    asString(stored.token) ||
    readAccessTokenCookie() ||
    "";
  const refreshToken =
    asString(tokens?.refreshToken) ||
    asString(stored.refreshToken) ||
    asString(stored.refresh_token) ||
    "";

  if (!accessToken) {
    return null;
  }

  return {
    user: {
      ...(user as AuthUser),
      id: userId,
      email: userEmail,
      fullName: userFullName,
    },
    tokens: {
      accessToken,
      refreshToken,
    },
  };
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

  let raw: string | null = null;

  try {
    raw = window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
  } catch {
    return null;
  }

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    const normalized = normalizeStoredSession(parsed);

    if (!normalized) {
      try {
        window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
      } catch {
        // Ignore localStorage cleanup failures.
      }
      return null;
    }

    if (JSON.stringify(parsed) !== JSON.stringify(normalized)) {
      window.localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(normalized));
    }

    writeAccessCookie(normalized.tokens.accessToken);
    return normalized;
  } catch {
    try {
      window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
    } catch {
      // Ignore localStorage cleanup failures.
    }
    return null;
  }
};

export const saveSession = (session: AuthSession) => {
  if (!isBrowser()) {
    return;
  }

  const normalized = normalizeStoredSession(session);

  if (!normalized) {
    clearSession();
    return;
  }

  window.localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(normalized));
  writeAccessCookie(normalized.tokens.accessToken);
  emitSessionChanged(normalized);
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

  try {
    window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
  } catch {
    // Ignore localStorage cleanup failures.
  }
  clearAccessCookie();
  emitSessionChanged(null);
};

export const getAccessToken = () => readSession()?.tokens.accessToken ?? null;
export const getRefreshToken = () => readSession()?.tokens.refreshToken ?? null;
export const hasAccessTokenCookie = () => Boolean(readAccessTokenCookie());
