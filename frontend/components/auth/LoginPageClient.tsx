"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ContentSection } from "@/components/PageShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useDemo } from "@/lib/demo-provider";
import { getFriendlyAuthError, useAuth } from "@/lib/auth-provider";
import { readSession } from "@/lib/auth/session-store";
import { isFirebaseClientConfigured } from "@/lib/firebase";
import { extractBackendErrorMessage } from "@/lib/auth/error-messages";
import { sanitizePostAuthPath } from "@/lib/auth/navigation";

const shouldRedirectToVerification = (
  kycStatus: string | undefined,
  emailVerified: boolean | undefined,
  phoneVerified: boolean | undefined,
) => {
  const status = (kycStatus || "").toLowerCase();
  if (status === "approved") {
    return false;
  }

  if (!emailVerified || !phoneVerified) {
    return true;
  }

  return status !== "approved";
};

type LoginPageClientProps = {
  rawNextPath?: string | null;
};

export function LoginPageClient({ rawNextPath }: LoginPageClientProps) {
  const { submitToast } = useDemo();
  const { signIn, verifyTwoFactorLogin, signInWithGoogle, resendEmailVerification, status, user } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);
  const [twoFactorLoginToken, setTwoFactorLoginToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const [error, setError] = useState("");

  const nextPath = useMemo(() => sanitizePostAuthPath(rawNextPath, "/wallet"), [rawNextPath]);

  const authenticatedDestination = useMemo(() => {
    const requiresVerification = shouldRedirectToVerification(user?.kycStatus, user?.emailVerified, user?.phoneVerified);
    return requiresVerification ? "/kyc" : nextPath;
  }, [nextPath, user?.emailVerified, user?.kycStatus, user?.phoneVerified]);

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }

    router.replace(authenticatedDestination);
  }, [authenticatedDestination, router, status]);

  const resetTwoFactorStep = () => {
    setRequiresTwoFactor(false);
    setTwoFactorCode("");
    setTwoFactorLoginToken("");
    setError("");
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (busy) {
      return;
    }

    setBusy(true);
    setError("");

    try {
      if (requiresTwoFactor) {
        if (!twoFactorLoginToken) {
          throw new Error("Two-factor login session expired. Please sign in again.");
        }

        await verifyTwoFactorLogin({
          loginToken: twoFactorLoginToken,
          code: twoFactorCode.trim(),
        });
        resetTwoFactorStep();
      } else {
        const result = await signIn({
          email: email.trim().toLowerCase(),
          password,
        });

        if (result.requiresTwoFactor) {
          setRequiresTwoFactor(true);
          setTwoFactorLoginToken(result.loginToken || "");
          setError(result.message || "Two-factor verification is required.");
          return;
        }
      }

      submitToast("Signed in", "Session is active. Continue to trading, wallet, and onboarding workflows.");

      const session = readSession();
      const requiresVerification = shouldRedirectToVerification(
        session?.user?.kycStatus,
        session?.user?.emailVerified,
        session?.user?.phoneVerified,
      );

      router.replace(requiresVerification ? "/kyc" : nextPath);
    } catch (requestError) {
      const backendMessage = extractBackendErrorMessage(requestError);
      setError(backendMessage || getFriendlyAuthError(requestError));
    } finally {
      setBusy(false);
    }
  };

  const onContinueWithGoogle = async () => {
    setGoogleBusy(true);
    setError("");

    try {
      const result = await signInWithGoogle();

      if (result.requiresTwoFactor) {
        setRequiresTwoFactor(true);
        setTwoFactorLoginToken(result.loginToken || "");
        setError(result.message || "Two-factor verification is required.");
        return;
      }

      const session = readSession();

      if (!session) {
        submitToast("Redirecting", "Continuing sign-in with Google...");
        return;
      }

      const requiresVerification = shouldRedirectToVerification(
        session.user?.kycStatus,
        session.user?.emailVerified,
        session.user?.phoneVerified,
      );
      router.replace(requiresVerification ? "/kyc" : nextPath);
    } catch (requestError) {
      const backendMessage = extractBackendErrorMessage(requestError);
      setError(backendMessage || getFriendlyAuthError(requestError));
    } finally {
      setGoogleBusy(false);
    }
  };

  const canResendVerification = !requiresTwoFactor && error.toLowerCase().includes("verify your email");

  const onResendVerification = async () => {
    setResendBusy(true);
    setError("");

    try {
      await resendEmailVerification();
      submitToast("Verification email sent", "Please check your inbox and verify your email before signing in.");
    } catch (requestError) {
      const backendMessage = extractBackendErrorMessage(requestError);
      setError(backendMessage || getFriendlyAuthError(requestError));
    } finally {
      setResendBusy(false);
    }
  };

  if (status === "loading") {
    return (
      <ContentSection>
        <div className="mx-auto flex min-h-[calc(100vh-17rem)] w-full max-w-xl items-center justify-center py-4">
          <div className="w-full rounded-2xl border border-white/10 bg-white/5 p-5 text-center">
            <p className="text-base font-semibold text-white">Checking your session...</p>
            <p className="mt-2 text-sm text-muted">
              Please wait while we restore your authentication state.
            </p>
          </div>
        </div>
      </ContentSection>
    );
  }

  if (status === "authenticated") {
    return (
      <ContentSection>
        <div className="mx-auto flex min-h-[calc(100vh-17rem)] w-full max-w-xl items-center justify-center py-4">
          <div className="w-full rounded-2xl border border-white/10 bg-white/5 p-5 text-center">
            <p className="text-base font-semibold text-white">Redirecting to your account...</p>
            <p className="mt-2 text-sm text-muted">You are already signed in.</p>
          </div>
        </div>
      </ContentSection>
    );
  }

  return (
    <ContentSection>
      <div className="mx-auto flex min-h-[calc(100vh-17rem)] w-full max-w-xl items-center justify-center py-4">
        <Card className="w-full rounded-[2rem] border-white/15 bg-gradient-to-b from-slate-950/95 via-slate-950/90 to-black/95 p-8 shadow-[0_30px_80px_rgba(0,0,0,0.5)]">
          <div className="space-y-2 text-center">
            <p className="text-xs uppercase tracking-[0.24em] text-accent">Authentication</p>
            <h1 className="text-3xl font-semibold text-white">Sign in to your account</h1>
            <p className="text-sm leading-6 text-muted">
              Access your wallet, trading workspace, and compliance workflow with secure session controls.
            </p>
          </div>

          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <input
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                resetTwoFactorStep();
              }}
              type="email"
              placeholder="Email"
              autoComplete="email"
              required
              disabled={requiresTwoFactor}
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white"
            />
            <input
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                resetTwoFactorStep();
              }}
              type="password"
              placeholder="Password"
              autoComplete="current-password"
              required
              disabled={requiresTwoFactor}
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white"
            />
            {requiresTwoFactor ? (
              <>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-muted">
                  Two-factor verification is enabled for this account. Enter your current 2FA code to continue.
                </div>
                <input
                  value={twoFactorCode}
                  onChange={(event) => setTwoFactorCode(event.target.value)}
                  type="text"
                  autoComplete="one-time-code"
                  placeholder="2FA or backup code"
                  required
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white"
                />
              </>
            ) : null}
            {error ? <p className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p> : null}
            {canResendVerification ? (
              <Button
                className="w-full"
                type="button"
                variant="secondary"
                disabled={resendBusy || busy || googleBusy}
                onClick={onResendVerification}
              >
                {resendBusy ? "Sending verification..." : "Resend verification email"}
              </Button>
            ) : null}
            <Button className="w-full" type="submit" disabled={busy}>
              {busy ? "Signing in..." : requiresTwoFactor ? "Verify and sign in" : "Sign in"}
            </Button>
            {requiresTwoFactor ? (
              <Button className="w-full" type="button" variant="secondary" disabled={busy} onClick={resetTwoFactorStep}>
                Use different credentials
              </Button>
            ) : null}
            {isFirebaseClientConfigured ? (
              <Button
                className="w-full"
                type="button"
                variant="secondary"
                disabled={googleBusy || busy || requiresTwoFactor}
                onClick={onContinueWithGoogle}
              >
                {googleBusy ? "Connecting..." : "Continue with Google"}
              </Button>
            ) : null}
            <div className="flex items-center justify-between text-sm text-muted">
              <Link href={`/signup${nextPath ? `?next=${encodeURIComponent(nextPath)}` : ""}`}>Create account</Link>
              <Link href="/forgot-password">Forgot password?</Link>
            </div>
          </form>
        </Card>
      </div>
    </ContentSection>
  );
}
