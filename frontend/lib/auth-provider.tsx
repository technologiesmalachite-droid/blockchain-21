"use client";

import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import type { User as FirebaseUser } from "firebase/auth";
import { AuthRequiredModal } from "@/components/auth/AuthRequiredModal";
import {
  firebaseSessionRequest,
  getProfileRequest,
  loginRequest,
  logoutRequest,
  registerRequest,
  sendEmailOtpLoginRequest,
  verifyEmailOtpLoginRequest,
  verifyTwoFactorLoginRequest,
  type LoginPayload,
  type RegisterPayload,
  type TwoFactorLoginChallenge,
} from "@/lib/api/auth";
import { ApiRequestError } from "@/lib/api/client";
import {
  deleteCurrentUserSafe,
  getFirebaseErrorCode,
  getFriendlyFirebaseAuthError,
  observeAuthState,
  resendCurrentUserVerificationEmail,
  signInWithEmail,
  signInWithGoogle,
  signOutUser,
  signUpWithEmail,
} from "@/lib/firebase-auth";
import {
  AUTH_REQUIRED_EVENT,
  SESSION_CHANGED_EVENT,
  clearSession,
  emitAuthRequired,
  getAccessToken,
  getRefreshToken,
  hasAccessTokenCookie,
  hasRefreshTokenCookie,
  readSession,
  saveSession,
  type AuthSession,
  type AuthUser,
} from "@/lib/auth/session-store";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";
export type AuthState = "loading" | "logged_out" | "email_otp_pending" | "two_factor_pending" | "authenticated";

type EmailOtpChallengeState = {
  email: string;
  message?: string;
  createdAt: number;
};

type TwoFactorChallengeState = {
  loginToken: string;
  message?: string;
  createdAt: number;
};

type GoogleAuthOptions = {
  countryCode?: string;
  termsAccepted?: boolean;
  privacyAccepted?: boolean;
};

type SignInResult = {
  requiresTwoFactor: boolean;
  loginToken?: string;
  message?: string;
};

type AuthContextType = {
  user: AuthUser | null;
  status: AuthStatus;
  authState: AuthState;
  isAuthenticated: boolean;
  emailOtpChallenge: EmailOtpChallengeState | null;
  isTwoFactorPending: boolean;
  twoFactorChallenge: TwoFactorChallengeState | null;
  signIn: (payload: LoginPayload) => Promise<SignInResult>;
  sendEmailOtpLogin: (payload: { email: string }) => Promise<{ message: string }>;
  verifyEmailOtpLogin: (payload: { email?: string; otp: string }) => Promise<SignInResult>;
  verifyTwoFactorLogin: (payload: { loginToken: string; code: string }) => Promise<void>;
  signUp: (payload: RegisterPayload) => Promise<void>;
  signInWithGoogle: (options?: GoogleAuthOptions) => Promise<SignInResult>;
  signUpWithGoogle: (options?: GoogleAuthOptions) => Promise<void>;
  resendEmailVerification: () => Promise<void>;
  signOut: () => Promise<void>;
  clearEmailOtpChallenge: () => void;
  clearTwoFactorChallenge: () => void;
  openAuthModal: (message?: string) => void;
  closeAuthModal: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);
const GOOGLE_INTENT_STORAGE_KEY = "malachitex.firebase.google.intent.v1";
const EMAIL_VERIFICATION_REQUIRED_CODE = "auth/email-not-verified";
const EMAIL_OTP_CHALLENGE_STORAGE_KEY = "malachitex.auth.email-otp.pending.v1";
const TWO_FACTOR_CHALLENGE_STORAGE_KEY = "malachitex.auth.two-factor.pending.v1";

const isAuthError = (error: unknown) => error instanceof ApiRequestError && error.status === 401;

const decodeJwtExpiryMs = (token: string): number | null => {
  if (!token || !token.includes(".")) {
    return null;
  }

  const [, payloadBase64] = token.split(".");
  if (!payloadBase64) {
    return null;
  }

  try {
    const base64 = payloadBase64.replace(/-/g, "+").replace(/_/g, "/");
    const normalized = `${base64}${"=".repeat((4 - (base64.length % 4)) % 4)}`;
    const payload = JSON.parse(atob(normalized)) as { exp?: number };
    if (!payload?.exp || !Number.isFinite(payload.exp)) {
      return null;
    }

    return payload.exp * 1000;
  } catch {
    return null;
  }
};

const hasFreshAccessToken = (token: string | undefined | null) => {
  if (!token) {
    return false;
  }

  const expiry = decodeJwtExpiryMs(token);
  if (!expiry) {
    return true;
  }

  return expiry > Date.now();
};

const isTwoFactorChallenge = (value: unknown): value is TwoFactorLoginChallenge =>
  Boolean(
    value &&
      typeof value === "object" &&
      "requiresTwoFactor" in value &&
      (value as { requiresTwoFactor?: boolean }).requiresTwoFactor === true &&
      "loginToken" in value,
  );

const readStoredEmailOtpChallenge = (): EmailOtpChallengeState | null => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(EMAIL_OTP_CHALLENGE_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<EmailOtpChallengeState>;
    if (!parsed || typeof parsed.email !== "string" || !parsed.email.trim()) {
      return null;
    }

    return {
      email: parsed.email.trim().toLowerCase(),
      message: typeof parsed.message === "string" ? parsed.message : undefined,
      createdAt: Number.isFinite(parsed.createdAt) ? Number(parsed.createdAt) : Date.now(),
    };
  } catch {
    return null;
  }
};

const persistEmailOtpChallenge = (challenge: EmailOtpChallengeState | null) => {
  if (typeof window === "undefined") {
    return;
  }

  if (!challenge) {
    window.sessionStorage.removeItem(EMAIL_OTP_CHALLENGE_STORAGE_KEY);
    return;
  }

  window.sessionStorage.setItem(EMAIL_OTP_CHALLENGE_STORAGE_KEY, JSON.stringify(challenge));
};

const readStoredTwoFactorChallenge = (): TwoFactorChallengeState | null => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(TWO_FACTOR_CHALLENGE_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<TwoFactorChallengeState>;
    if (!parsed || typeof parsed.loginToken !== "string" || !parsed.loginToken.trim()) {
      return null;
    }

    return {
      loginToken: parsed.loginToken,
      message: typeof parsed.message === "string" ? parsed.message : undefined,
      createdAt: Number.isFinite(parsed.createdAt) ? Number(parsed.createdAt) : Date.now(),
    };
  } catch {
    return null;
  }
};

const persistTwoFactorChallenge = (challenge: TwoFactorChallengeState | null) => {
  if (typeof window === "undefined") {
    return;
  }

  if (!challenge) {
    window.sessionStorage.removeItem(TWO_FACTOR_CHALLENGE_STORAGE_KEY);
    return;
  }

  window.sessionStorage.setItem(TWO_FACTOR_CHALLENGE_STORAGE_KEY, JSON.stringify(challenge));
};

const saveGoogleIntent = (options?: GoogleAuthOptions) => {
  if (typeof window === "undefined" || !options) {
    return;
  }

  window.sessionStorage.setItem(GOOGLE_INTENT_STORAGE_KEY, JSON.stringify(options));
};

const readGoogleIntent = (): GoogleAuthOptions | undefined => {
  if (typeof window === "undefined") {
    return undefined;
  }

  const raw = window.sessionStorage.getItem(GOOGLE_INTENT_STORAGE_KEY);
  if (!raw) {
    return undefined;
  }

  try {
    return JSON.parse(raw) as GoogleAuthOptions;
  } catch {
    return undefined;
  }
};

const clearGoogleIntent = () => {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(GOOGLE_INTENT_STORAGE_KEY);
};

const signInSuccessResult = (): SignInResult => ({ requiresTwoFactor: false });

const signInChallengeResult = (challenge: TwoFactorLoginChallenge): SignInResult => ({
  requiresTwoFactor: true,
  loginToken: challenge.loginToken,
  message: challenge.message,
});

const shouldDebugAuthProvider = () =>
  (() => {
    if (typeof window === "undefined") {
      return false;
    }

    if (process.env.NODE_ENV !== "production") {
      return true;
    }

    try {
      return window.localStorage.getItem("mx_debug_auth") === "1";
    } catch {
      return false;
    }
  })();

const logAuthProvider = (event: string, payload: Record<string, unknown>) => {
  if (!shouldDebugAuthProvider()) {
    return;
  }

  console.info(`[auth-provider] ${event}`, payload);
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [sessionBootstrapped, setSessionBootstrapped] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [firebaseReady, setFirebaseReady] = useState(false);
  const [syncingFirebaseSession, setSyncingFirebaseSession] = useState(false);
  const [restoringSessionFromToken, setRestoringSessionFromToken] = useState(false);
  const [hydrationTimedOut, setHydrationTimedOut] = useState(false);
  const [emailOtpChallenge, setEmailOtpChallenge] = useState<EmailOtpChallengeState | null>(null);
  const [twoFactorChallenge, setTwoFactorChallenge] = useState<TwoFactorChallengeState | null>(null);
  const [firebaseSessionSyncUid, setFirebaseSessionSyncUid] = useState<string | null>(null);
  const [authModal, setAuthModal] = useState<{ open: boolean; message: string }>({
    open: false,
    message: "Please sign in to continue.",
  });
  const currentAccessToken = session?.tokens?.accessToken || null;
  const clearEmailOtpChallenge = () => {
    setEmailOtpChallenge(null);
  };
  const clearTwoFactorChallenge = () => {
    setTwoFactorChallenge(null);
  };
  const markTwoFactorChallenge = (challenge: TwoFactorLoginChallenge) => {
    setTwoFactorChallenge({
      loginToken: challenge.loginToken,
      message: challenge.message,
      createdAt: Date.now(),
    });
  };
  const markEmailOtpChallenge = ({ email, message }: { email: string; message?: string }) => {
    setEmailOtpChallenge({
      email: email.trim().toLowerCase(),
      message,
      createdAt: Date.now(),
    });
  };

  useEffect(() => {
    const existing = readSession();
    const hasValidAccessToken = hasFreshAccessToken(existing?.tokens?.accessToken);
    logAuthProvider("session_bootstrap", {
      hasSession: Boolean(existing),
      hasAccessToken: Boolean(existing?.tokens?.accessToken),
      hasRefreshToken: Boolean(existing?.tokens?.refreshToken),
      hasValidAccessToken,
    });
    setSession(existing);
    setStatus(hasValidAccessToken ? "authenticated" : "unauthenticated");
    setEmailOtpChallenge(hasValidAccessToken ? null : readStoredEmailOtpChallenge());
    setTwoFactorChallenge(hasValidAccessToken ? null : readStoredTwoFactorChallenge());
    setSessionBootstrapped(true);
  }, []);

  useEffect(() => {
    if (sessionBootstrapped && firebaseReady) {
      setHydrationTimedOut(false);
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      logAuthProvider("hydration_timeout", {
        sessionBootstrapped,
        firebaseReady,
      });
      setHydrationTimedOut(true);
    }, 6000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [firebaseReady, sessionBootstrapped]);

  useEffect(() => {
    persistEmailOtpChallenge(emailOtpChallenge);
  }, [emailOtpChallenge]);

  useEffect(() => {
    persistTwoFactorChallenge(twoFactorChallenge);
  }, [twoFactorChallenge]);

  useEffect(() => {
    const unsubscribe = observeAuthState((nextFirebaseUser) => {
      setFirebaseUser(nextFirebaseUser);
      setFirebaseReady(true);

      if (!nextFirebaseUser) {
        setFirebaseSessionSyncUid(null);
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!firebaseReady || firebaseUser || !session?.tokens?.refreshToken) {
      return;
    }

    const provider = (session.user?.authProvider || "local").toLowerCase();
    if (provider === "local") {
      return;
    }

    logoutRequest(session.tokens.refreshToken).catch(() => {});
    clearEmailOtpChallenge();
    clearTwoFactorChallenge();
    clearSession();
  }, [firebaseReady, firebaseUser, session?.tokens?.refreshToken, session?.user?.authProvider]);

  useEffect(() => {
    const onSessionChanged = (event: Event) => {
      const detail = (event as CustomEvent<AuthSession | null>).detail;
      const hasValidAccessToken = hasFreshAccessToken(detail?.tokens?.accessToken);
      setSession(detail);
      setStatus(hasValidAccessToken ? "authenticated" : "unauthenticated");
      if (detail) {
        setEmailOtpChallenge(null);
        setTwoFactorChallenge(null);
      }
    };

    const onAuthRequired = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      setAuthModal({
        open: true,
        message: detail || "Please sign in to continue.",
      });
    };

    window.addEventListener(SESSION_CHANGED_EVENT, onSessionChanged);
    window.addEventListener(AUTH_REQUIRED_EVENT, onAuthRequired);

    return () => {
      window.removeEventListener(SESSION_CHANGED_EVENT, onSessionChanged);
      window.removeEventListener(AUTH_REQUIRED_EVENT, onAuthRequired);
    };
  }, []);

  const hasActiveAccessToken = hasFreshAccessToken(currentAccessToken);

  useEffect(() => {
    if (!hasActiveAccessToken) {
      return;
    }

    let active = true;

    getProfileRequest()
      .then((payload) => {
        if (!active) {
          return;
        }

        const currentSession = readSession();
        if (!currentSession) {
          return;
        }

        saveSession({
          ...currentSession,
          user: payload.user,
        });
      })
      .catch((error) => {
        if (!active) {
          return;
        }

        if (isAuthError(error)) {
          clearEmailOtpChallenge();
          clearTwoFactorChallenge();
          clearSession();
        }
      });

    return () => {
      active = false;
    };
  }, [currentAccessToken, hasActiveAccessToken]);

  useEffect(() => {
    if (!sessionBootstrapped || status !== "unauthenticated" || hasActiveAccessToken || restoringSessionFromToken) {
      return;
    }

    const hasRecoveryCookie = hasAccessTokenCookie() || hasRefreshTokenCookie();
    if (!hasRecoveryCookie) {
      return;
    }

    logAuthProvider("cookie_recovery_start", {
      hasAccessTokenCookie: hasAccessTokenCookie(),
      hasRefreshTokenCookie: hasRefreshTokenCookie(),
    });

    let active = true;
    setRestoringSessionFromToken(true);

    getProfileRequest()
      .then((payload) => {
        if (!active) {
          return;
        }

        const accessToken = getAccessToken();
        if (!accessToken) {
          return;
        }

        saveSession({
          user: payload.user,
          tokens: {
            accessToken,
            refreshToken: getRefreshToken() || "",
          },
        });

        logAuthProvider("cookie_recovery_success", {
          hasAccessToken: Boolean(accessToken),
          hasRefreshToken: Boolean(getRefreshToken()),
        });
      })
      .catch((error) => {
        if (!active) {
          return;
        }

        logAuthProvider("cookie_recovery_failed", {
          message: error instanceof Error ? error.message : "unknown_error",
          isAuthError: isAuthError(error),
        });

        if (isAuthError(error)) {
          clearEmailOtpChallenge();
          clearTwoFactorChallenge();
          clearSession();
        }
      })
      .finally(() => {
        if (!active) {
          return;
        }

        setRestoringSessionFromToken(false);
      });

    return () => {
      active = false;
    };
  }, [hasActiveAccessToken, restoringSessionFromToken, sessionBootstrapped, status]);

  useEffect(() => {
    if (!firebaseReady || !firebaseUser || session?.tokens.accessToken || syncingFirebaseSession) {
      return;
    }

    if (firebaseSessionSyncUid === firebaseUser.uid) {
      return;
    }

    let active = true;
    setSyncingFirebaseSession(true);
    setFirebaseSessionSyncUid(firebaseUser.uid);

    const intent = readGoogleIntent();

    firebaseUser
      .getIdToken()
      .then((idToken) =>
        firebaseSessionRequest({
          idToken,
          countryCode: intent?.countryCode,
          termsAccepted: intent?.termsAccepted,
          privacyAccepted: intent?.privacyAccepted,
        }),
      )
      .then(async (result) => {
        if (!active) {
          return;
        }

        if (isTwoFactorChallenge(result)) {
          clearSession();
          clearEmailOtpChallenge();
          markTwoFactorChallenge(result);
          setAuthModal({
            open: true,
            message: result.message || "Two-factor verification is required. Continue from the sign-in page.",
          });
          if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
            const next = `${window.location.pathname}${window.location.search}`;
            window.location.assign(`/login?next=${encodeURIComponent(next)}`);
          }
          return;
        }

        saveSession(result);
        clearGoogleIntent();
        setAuthModal((current) => ({ ...current, open: false }));
      })
      .catch(async (error) => {
        if (!active) {
          return;
        }

        const friendlyFirebaseError = getFriendlyFirebaseAuthError(error);
        if (friendlyFirebaseError) {
          setAuthModal({
            open: true,
            message: friendlyFirebaseError,
          });
          return;
        }

        if (error instanceof ApiRequestError && error.status === 400) {
          setAuthModal({
            open: true,
            message: "Google account is authenticated but backend profile setup is incomplete. Please complete signup consent and try again.",
          });
          await signOutUser().catch(() => {});
          return;
        }

        if (isAuthError(error)) {
          clearEmailOtpChallenge();
          clearTwoFactorChallenge();
          clearSession();

          if (firebaseUser?.emailVerified === false) {
            setAuthModal({
              open: true,
              message: "Verify your email before continuing. You can resend verification from the sign-in page.",
            });
            return;
          }

          await signOutUser().catch(() => {});
          return;
        }

        setAuthModal({
          open: true,
          message: "Unable to finalize session with the server. Please try again.",
        });
      })
      .finally(() => {
        if (!active) {
          return;
        }
        setSyncingFirebaseSession(false);
      });

    return () => {
      active = false;
    };
  }, [firebaseReady, firebaseSessionSyncUid, firebaseUser, session?.tokens.accessToken, syncingFirebaseSession]);

  const signIn = async (payload: LoginPayload) => {
    let firebaseSignedIn = false;
    clearSession();
    clearEmailOtpChallenge();
    clearTwoFactorChallenge();

    try {
      try {
        const firebaseCredential = await signInWithEmail(payload.email, payload.password);
        firebaseSignedIn = true;

        if (!firebaseCredential.user.emailVerified) {
          await resendCurrentUserVerificationEmail().catch(() => false);
          const verificationError = new Error(
            "Please verify your email before signing in. A verification email has been sent.",
          ) as Error & { code?: string };
          verificationError.code = EMAIL_VERIFICATION_REQUIRED_CODE;
          throw verificationError;
        }

        const idToken = await firebaseCredential.user.getIdToken();
        const result = await firebaseSessionRequest({ idToken });

        if (isTwoFactorChallenge(result)) {
          clearSession();
          clearEmailOtpChallenge();
          markTwoFactorChallenge(result);
          return signInChallengeResult(result);
        }

        saveSession(result);
        clearTwoFactorChallenge();
        clearGoogleIntent();
        setAuthModal((current) => ({ ...current, open: false }));
        return signInSuccessResult();
      } catch (firebaseError) {
        if (firebaseError instanceof ApiRequestError) {
          throw firebaseError;
        }

        const friendlyFirebaseError = getFriendlyFirebaseAuthError(firebaseError);
        const firebaseCode = getFirebaseErrorCode(firebaseError);

        if (firebaseCode === EMAIL_VERIFICATION_REQUIRED_CODE) {
          throw firebaseError;
        }

        const canFallbackToLegacyLogin =
          firebaseCode === "auth/user-not-found" || firebaseCode === "auth/configuration-not-found";

        if (!canFallbackToLegacyLogin) {
          throw new Error(friendlyFirebaseError || "Unable to authenticate with Firebase.");
        }

        if (firebaseCode === "auth/configuration-not-found" && !friendlyFirebaseError) {
          throw new Error("Authentication is not configured yet. Please contact support.");
        }
      }

      const result = await loginRequest(payload);
      if (isTwoFactorChallenge(result)) {
        clearSession();
        clearEmailOtpChallenge();
        markTwoFactorChallenge(result);
        return signInChallengeResult(result);
      }

      saveSession(result);
      clearTwoFactorChallenge();
      clearGoogleIntent();
      setAuthModal((current) => ({ ...current, open: false }));
      return signInSuccessResult();
    } catch (error) {
      const firebaseCode = getFirebaseErrorCode(error);
      const preserveFirebaseSession = firebaseCode === EMAIL_VERIFICATION_REQUIRED_CODE;

      if (firebaseSignedIn && !preserveFirebaseSession) {
        await signOutUser().catch(() => {});
      }

      throw error;
    }
  };

  const verifyTwoFactorLogin = async ({ loginToken, code }: { loginToken: string; code: string }) => {
    const sessionPayload = await verifyTwoFactorLoginRequest({ loginToken, code });
    saveSession(sessionPayload);
    clearEmailOtpChallenge();
    clearTwoFactorChallenge();
    clearGoogleIntent();
    setAuthModal((current) => ({ ...current, open: false }));
  };

  const sendEmailOtpLogin = async ({ email }: { email: string }) => {
    const normalizedEmail = email.trim().toLowerCase();
    clearSession();
    clearEmailOtpChallenge();
    const response = await sendEmailOtpLoginRequest({ email: normalizedEmail });
    clearTwoFactorChallenge();
    markEmailOtpChallenge({
      email: normalizedEmail,
      message: response.message,
    });
    return response;
  };

  const verifyEmailOtpLogin = async ({ email, otp }: { email?: string; otp: string }): Promise<SignInResult> => {
    const challengeEmail = email?.trim().toLowerCase() || emailOtpChallenge?.email || "";
    if (!challengeEmail) {
      throw new Error("Session expired, please sign in again.");
    }

    const result = await verifyEmailOtpLoginRequest({
      email: challengeEmail,
      otp: otp.trim(),
    });

    if (isTwoFactorChallenge(result)) {
      clearSession();
      clearEmailOtpChallenge();
      markTwoFactorChallenge(result);
      return signInChallengeResult(result);
    }

    saveSession(result);
    clearEmailOtpChallenge();
    clearTwoFactorChallenge();
    clearGoogleIntent();
    setAuthModal((current) => ({ ...current, open: false }));
    return signInSuccessResult();
  };

  const signUp = async (payload: RegisterPayload) => {
    let firebaseUserCreated = false;

    try {
      try {
        await signUpWithEmail(payload.email, payload.password, payload.fullName);
        firebaseUserCreated = true;
        await resendCurrentUserVerificationEmail().catch(() => false);
      } catch (firebaseError) {
        const firebaseCode = getFirebaseErrorCode(firebaseError);
        if (firebaseCode !== "auth/configuration-not-found") {
          throw firebaseError;
        }
      }

      const result = await registerRequest(payload);
      saveSession(result);
      clearEmailOtpChallenge();
      clearTwoFactorChallenge();
      clearGoogleIntent();
      setAuthModal((current) => ({ ...current, open: false }));
    } catch (error) {
      if (firebaseUserCreated) {
        await deleteCurrentUserSafe();
        await signOutUser().catch(() => {});
      }

      throw error;
    }
  };

  const signInWithGoogleAccount = async (options?: GoogleAuthOptions) => {
    clearEmailOtpChallenge();
    clearTwoFactorChallenge();
    saveGoogleIntent(options);

    const googleResult = await signInWithGoogle();

    if (googleResult.redirected) {
      return signInSuccessResult();
    }

    const idToken = await googleResult.credential.user.getIdToken();

    try {
      const result = await firebaseSessionRequest({
        idToken,
        countryCode: options?.countryCode,
        termsAccepted: options?.termsAccepted,
        privacyAccepted: options?.privacyAccepted,
      });

      if (isTwoFactorChallenge(result)) {
        clearSession();
        clearEmailOtpChallenge();
        markTwoFactorChallenge(result);
        return signInChallengeResult(result);
      }

      saveSession(result);
      clearTwoFactorChallenge();
      clearGoogleIntent();
      setAuthModal((current) => ({ ...current, open: false }));
      return signInSuccessResult();
    } catch (error) {
      await signOutUser().catch(() => {});
      throw error;
    }
  };

  const signInWithGoogleHandler = async (options?: GoogleAuthOptions) => signInWithGoogleAccount(options);

  const signUpWithGoogleHandler = async (options?: GoogleAuthOptions) => {
    if (!options?.termsAccepted || !options?.privacyAccepted) {
      throw new Error("Terms and privacy consent are required before continuing with Google.");
    }

    const result = await signInWithGoogleAccount(options);
    if (result.requiresTwoFactor) {
      await signOutUser().catch(() => {});
      throw new Error("This account already exists with two-factor authentication enabled. Please sign in instead.");
    }
  };

  const resendEmailVerification = async () => {
    const sent = await resendCurrentUserVerificationEmail();
    if (!sent) {
      throw new Error("Email is already verified.");
    }
  };

  const signOut = async () => {
    const refreshToken = session?.tokens.refreshToken;

    try {
      await logoutRequest(refreshToken || undefined);
    } catch {
      // Session cleanup is handled locally even if logout request fails.
    }

    await signOutUser().catch(() => {});
    clearEmailOtpChallenge();
    clearTwoFactorChallenge();
    clearGoogleIntent();
    clearSession();
  };

  const openAuthModal = (message = "Please sign in to continue.") => {
    setAuthModal({ open: true, message });
  };

  const closeAuthModal = () => setAuthModal((current) => ({ ...current, open: false }));

  const cookieSessionRecoveryPending =
    sessionBootstrapped &&
    status === "unauthenticated" &&
    !hasActiveAccessToken &&
    (hasAccessTokenCookie() || hasRefreshTokenCookie());
  const authBootstrapPending =
    !hydrationTimedOut &&
    (!sessionBootstrapped || !firebaseReady || restoringSessionFromToken || cookieSessionRecoveryPending);
  const resolvedAuthState: AuthState =
    authBootstrapPending || status === "loading" || (syncingFirebaseSession && !session?.tokens.accessToken)
      ? "loading"
      : hasActiveAccessToken
        ? "authenticated"
        : twoFactorChallenge?.loginToken
          ? "two_factor_pending"
          : emailOtpChallenge?.email
            ? "email_otp_pending"
          : "logged_out";
  const resolvedStatus: AuthStatus = resolvedAuthState === "loading"
    ? "loading"
    : resolvedAuthState === "authenticated"
      ? "authenticated"
      : "unauthenticated";

  useEffect(() => {
    logAuthProvider("resolved_status", {
      status: resolvedStatus,
      authState: resolvedAuthState,
      authBootstrapPending,
      syncingFirebaseSession,
      restoringSessionFromToken,
      hydrationTimedOut,
      hasSession: Boolean(session),
      hasAccessToken: Boolean(session?.tokens?.accessToken),
      hasRefreshToken: Boolean(session?.tokens?.refreshToken),
      emailOtpPending: Boolean(emailOtpChallenge?.email),
      twoFactorPending: Boolean(twoFactorChallenge?.loginToken),
    });
  }, [authBootstrapPending, emailOtpChallenge?.email, hydrationTimedOut, resolvedAuthState, resolvedStatus, restoringSessionFromToken, session, syncingFirebaseSession, twoFactorChallenge?.loginToken]);

  const value = useMemo<AuthContextType>(
    () => ({
      user: session?.user ?? null,
      status: resolvedStatus,
      authState: resolvedAuthState,
      isAuthenticated: resolvedAuthState === "authenticated",
      emailOtpChallenge,
      isTwoFactorPending: resolvedAuthState === "two_factor_pending",
      twoFactorChallenge,
      signIn,
      sendEmailOtpLogin,
      verifyEmailOtpLogin,
      verifyTwoFactorLogin,
      signUp,
      signInWithGoogle: signInWithGoogleHandler,
      signUpWithGoogle: signUpWithGoogleHandler,
      resendEmailVerification,
      signOut,
      clearEmailOtpChallenge,
      clearTwoFactorChallenge,
      openAuthModal,
      closeAuthModal,
    }),
    [emailOtpChallenge, resolvedAuthState, resolvedStatus, session, twoFactorChallenge],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      <AuthRequiredModal open={authModal.open} message={authModal.message} onClose={closeAuthModal} />
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
}

export const getFriendlyAuthError = (error: unknown) => {
  const knownMessage = error instanceof ApiRequestError ? error.message?.trim() || "" : "";
  const knownMessageLower = knownMessage.toLowerCase();

  if (knownMessageLower.includes("invalid credentials")) {
    return "Invalid email or password.";
  }

  if (knownMessageLower.includes("invalid email")) {
    return "Invalid email.";
  }

  if (knownMessageLower.includes("otp sent successfully")) {
    return "OTP sent successfully.";
  }

  if (knownMessageLower.includes("invalid otp")) {
    return "Invalid OTP.";
  }

  if (knownMessageLower.includes("otp expired")) {
    return "OTP expired.";
  }

  if (knownMessageLower.includes("too many attempts")) {
    return "Too many attempts, try again later.";
  }

  if (knownMessageLower.includes("please wait before requesting another otp")) {
    return "Too many attempts, try again later.";
  }

  if (knownMessageLower.includes("two-factor verification is required")) {
    return "2FA code required. Enter your authenticator code to continue.";
  }

  if (
    knownMessageLower.includes("invalid two-factor") ||
    knownMessageLower.includes("invalid two factor") ||
    knownMessageLower.includes("invalid authenticator")
  ) {
    return "Invalid 2FA code. Please try again.";
  }

  if (
    knownMessageLower.includes("login session is invalid or expired") ||
    knownMessageLower.includes("session is invalid or expired")
  ) {
    return "Session expired, please sign in again.";
  }

  const firebaseMessage = getFriendlyFirebaseAuthError(error);
  if (firebaseMessage) {
    return firebaseMessage;
  }

  if (error instanceof Error && !(error instanceof ApiRequestError)) {
    if (error.message.includes("consent")) {
      return "Please accept terms and privacy policy before continuing.";
    }

    return error.message || "We couldn't complete authentication right now. Please try again.";
  }

  if (!(error instanceof ApiRequestError)) {
    return "We couldn't complete authentication right now. Please try again.";
  }

  if (error.code === "network_error") {
    return "Unable to reach the authentication service. Please try again in a moment.";
  }

  if (error.status === 401) {
    return knownMessage || "Invalid email or password.";
  }

  if (error.status === 403) {
    return "Your account is restricted for this action. Complete verification or contact support.";
  }

  if (error.status === 409) {
    return "This account already exists. Please sign in instead.";
  }

  if (error.status === 429) {
    return "Too many authentication attempts. Please wait a few minutes before trying again.";
  }

  if (error.status === 400) {
    return error.message || "Please review your details and try again.";
  }

  if (error.status === 503) {
    return "Authentication service is temporarily unavailable. Please try again shortly.";
  }

  return "Authentication failed. Please try again.";
};

export const ensureAuthOrPrompt = (isAuthenticated: boolean) => {
  if (isAuthenticated) {
    return true;
  }

  emitAuthRequired();
  return false;
};
