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
  readSession,
  saveSession,
  type AuthSession,
  type AuthUser,
} from "@/lib/auth/session-store";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

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
  isAuthenticated: boolean;
  signIn: (payload: LoginPayload) => Promise<SignInResult>;
  verifyTwoFactorLogin: (payload: { loginToken: string; code: string }) => Promise<void>;
  signUp: (payload: RegisterPayload) => Promise<void>;
  signInWithGoogle: (options?: GoogleAuthOptions) => Promise<SignInResult>;
  signUpWithGoogle: (options?: GoogleAuthOptions) => Promise<void>;
  resendEmailVerification: () => Promise<void>;
  signOut: () => Promise<void>;
  openAuthModal: (message?: string) => void;
  closeAuthModal: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);
const GOOGLE_INTENT_STORAGE_KEY = "malachitex.firebase.google.intent.v1";
const EMAIL_VERIFICATION_REQUIRED_CODE = "auth/email-not-verified";

const isAuthError = (error: unknown) => error instanceof ApiRequestError && (error.status === 401 || error.status === 403);

const isTwoFactorChallenge = (value: unknown): value is TwoFactorLoginChallenge =>
  Boolean(
    value &&
      typeof value === "object" &&
      "requiresTwoFactor" in value &&
      (value as { requiresTwoFactor?: boolean }).requiresTwoFactor === true &&
      "loginToken" in value,
  );

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [sessionBootstrapped, setSessionBootstrapped] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [firebaseReady, setFirebaseReady] = useState(false);
  const [syncingFirebaseSession, setSyncingFirebaseSession] = useState(false);
  const [restoringSessionFromToken, setRestoringSessionFromToken] = useState(false);
  const [firebaseSessionSyncUid, setFirebaseSessionSyncUid] = useState<string | null>(null);
  const [authModal, setAuthModal] = useState<{ open: boolean; message: string }>({
    open: false,
    message: "Please sign in to continue.",
  });

  useEffect(() => {
    const existing = readSession();
    setSession(existing);
    setStatus(existing ? "authenticated" : "unauthenticated");
    setSessionBootstrapped(true);
  }, []);

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
    clearSession();
  }, [firebaseReady, firebaseUser, session?.tokens?.refreshToken, session?.user?.authProvider]);

  useEffect(() => {
    const onSessionChanged = (event: Event) => {
      const detail = (event as CustomEvent<AuthSession | null>).detail;
      setSession(detail);
      setStatus(detail ? "authenticated" : "unauthenticated");
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

  useEffect(() => {
    if (!session?.tokens.accessToken) {
      return;
    }

    let active = true;

    getProfileRequest()
      .then((payload) => {
        if (!active) {
          return;
        }

        const refreshedSession: AuthSession = {
          ...session,
          user: payload.user,
        };
        saveSession(refreshedSession);
      })
      .catch((error) => {
        if (!active) {
          return;
        }

        if (isAuthError(error)) {
          clearSession();
        }
      });

    return () => {
      active = false;
    };
  }, [session?.tokens.accessToken]);

  useEffect(() => {
    if (!sessionBootstrapped || status !== "unauthenticated" || session?.tokens.accessToken || restoringSessionFromToken) {
      return;
    }

    if (!hasAccessTokenCookie()) {
      return;
    }

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
      })
      .catch((error) => {
        if (!active) {
          return;
        }

        if (isAuthError(error)) {
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
  }, [restoringSessionFromToken, session?.tokens.accessToken, sessionBootstrapped, status]);

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
          return signInChallengeResult(result);
        }

        saveSession(result);
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
        return signInChallengeResult(result);
      }

      saveSession(result);
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
    clearGoogleIntent();
    setAuthModal((current) => ({ ...current, open: false }));
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
        return signInChallengeResult(result);
      }

      saveSession(result);
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

    if (refreshToken) {
      try {
        await logoutRequest(refreshToken);
      } catch {
        // Session cleanup is handled locally even if logout request fails.
      }
    }

    await signOutUser().catch(() => {});
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
    !session?.tokens.accessToken &&
    hasAccessTokenCookie();
  const authBootstrapPending = !sessionBootstrapped || !firebaseReady || restoringSessionFromToken || cookieSessionRecoveryPending;
  const resolvedStatus: AuthStatus =
    authBootstrapPending || status === "loading" || (syncingFirebaseSession && !session?.tokens.accessToken)
      ? "loading"
      : status;

  const value = useMemo<AuthContextType>(
    () => ({
      user: session?.user ?? null,
      status: resolvedStatus,
      isAuthenticated: resolvedStatus === "authenticated",
      signIn,
      verifyTwoFactorLogin,
      signUp,
      signInWithGoogle: signInWithGoogleHandler,
      signUpWithGoogle: signUpWithGoogleHandler,
      resendEmailVerification,
      signOut,
      openAuthModal,
      closeAuthModal,
    }),
    [resolvedStatus, session],
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
    return "Invalid credentials or expired authentication. Please sign in again.";
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
