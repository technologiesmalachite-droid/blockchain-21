"use client";

import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { AuthRequiredModal } from "@/components/auth/AuthRequiredModal";
import { getProfileRequest, loginRequest, logoutRequest, registerRequest, type LoginPayload, type RegisterPayload } from "@/lib/api/auth";
import { ApiRequestError } from "@/lib/api/client";
import {
  AUTH_REQUIRED_EVENT,
  SESSION_CHANGED_EVENT,
  clearSession,
  emitAuthRequired,
  readSession,
  saveSession,
  type AuthSession,
  type AuthUser,
} from "@/lib/auth/session-store";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthContextType = {
  user: AuthUser | null;
  status: AuthStatus;
  isAuthenticated: boolean;
  signIn: (payload: LoginPayload) => Promise<void>;
  signUp: (payload: RegisterPayload) => Promise<void>;
  signOut: () => Promise<void>;
  openAuthModal: (message?: string) => void;
  closeAuthModal: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

const isAuthError = (error: unknown) => error instanceof ApiRequestError && (error.status === 401 || error.status === 403);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [authModal, setAuthModal] = useState<{ open: boolean; message: string }>({
    open: false,
    message: "Please sign in to continue.",
  });

  useEffect(() => {
    const existing = readSession();
    setSession(existing);
    setStatus(existing ? "authenticated" : "unauthenticated");
  }, []);

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
          return;
        }
      });

    return () => {
      active = false;
    };
  }, [session?.tokens.accessToken]);

  const signIn = async (payload: LoginPayload) => {
    const result = await loginRequest(payload);
    saveSession(result);
    setAuthModal((current) => ({ ...current, open: false }));
  };

  const signUp = async (payload: RegisterPayload) => {
    const result = await registerRequest(payload);
    saveSession(result);
    setAuthModal((current) => ({ ...current, open: false }));
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

    clearSession();
  };

  const openAuthModal = (message = "Please sign in to continue.") => {
    setAuthModal({ open: true, message });
  };

  const closeAuthModal = () => setAuthModal((current) => ({ ...current, open: false }));

  const value = useMemo<AuthContextType>(
    () => ({
      user: session?.user ?? null,
      status,
      isAuthenticated: status === "authenticated",
      signIn,
      signUp,
      signOut,
      openAuthModal,
      closeAuthModal,
    }),
    [session, status],
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
  if (!(error instanceof ApiRequestError)) {
    return "We couldn't complete authentication right now. Please try again.";
  }

  if (error.code === "network_error") {
    return "Unable to reach the authentication service. Please try again in a moment.";
  }

  if (error.status === 401) {
    return "Invalid credentials or missing 2FA code. Please check your details and try again.";
  }

  if (error.status === 403) {
    return "Your account is restricted for this action. Complete verification or contact support.";
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
