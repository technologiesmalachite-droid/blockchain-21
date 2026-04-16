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
import { ApiRequestError } from "@/lib/api/client";

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

type LoginMode = "password" | "email_otp";

type LoginPageClientProps = {
  rawNextPath?: string | null;
};

export function LoginPageClient({ rawNextPath }: LoginPageClientProps) {
  const { submitToast } = useDemo();
  const {
    signIn,
    sendEmailOtpLogin,
    verifyEmailOtpLogin,
    verifyTwoFactorLogin,
    signInWithGoogle,
    resendEmailVerification,
    authState,
    emailOtpChallenge,
    isTwoFactorPending,
    twoFactorChallenge,
    clearEmailOtpChallenge,
    clearTwoFactorChallenge,
    user,
  } = useAuth();
  const router = useRouter();
  const [loginMode, setLoginMode] = useState<LoginMode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailOtpCode, setEmailOtpCode] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const [error, setError] = useState("");

  const nextPath = useMemo(() => sanitizePostAuthPath(rawNextPath, "/wallet"), [rawNextPath]);
  const authenticatedDestination = useMemo(() => {
    const requiresVerification = shouldRedirectToVerification(user?.kycStatus, user?.emailVerified, user?.phoneVerified);
    return requiresVerification ? "/kyc" : nextPath;
  }, [nextPath, user?.emailVerified, user?.kycStatus, user?.phoneVerified]);

  const showTwoFactorStep = isTwoFactorPending && Boolean(twoFactorChallenge?.loginToken);
  const showEmailOtpStep = authState === "email_otp_pending" && Boolean(emailOtpChallenge?.email);
  const effectiveEmail = showEmailOtpStep ? emailOtpChallenge?.email || "" : email.trim().toLowerCase();
  const usingEmailOtpFlow = loginMode === "email_otp" || showEmailOtpStep;

  useEffect(() => {
    if (authState !== "authenticated") {
      return;
    }

    router.replace(authenticatedDestination);
  }, [authState, authenticatedDestination, router]);

  useEffect(() => {
    if (showEmailOtpStep) {
      setLoginMode("email_otp");
    }
  }, [showEmailOtpStep]);

  const clearPendingChallenges = () => {
    clearTwoFactorChallenge();
    clearEmailOtpChallenge();
  };

  const usePasswordMode = () => {
    clearPendingChallenges();
    setEmailOtpCode("");
    setTwoFactorCode("");
    setError("");
    setLoginMode("password");
  };

  const useEmailOtpMode = () => {
    clearTwoFactorChallenge();
    setTwoFactorCode("");
    setError("");
    setLoginMode("email_otp");
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (busy) {
      return;
    }

    setBusy(true);
    setError("");

    try {
      if (showTwoFactorStep) {
        const loginToken = twoFactorChallenge?.loginToken || "";
        if (!loginToken) {
          clearTwoFactorChallenge();
          throw new Error("Session expired, please sign in again.");
        }
        if (!twoFactorCode.trim()) {
          throw new Error("2FA code required. Enter your authenticator code to continue.");
        }

        await verifyTwoFactorLogin({
          loginToken,
          code: twoFactorCode.trim(),
        });
      } else if (usingEmailOtpFlow) {
        if (!effectiveEmail) {
          throw new Error("Invalid email.");
        }

        if (showEmailOtpStep) {
          if (!emailOtpCode.trim()) {
            throw new Error("OTP is required.");
          }

          const result = await verifyEmailOtpLogin({
            email: effectiveEmail,
            otp: emailOtpCode.trim(),
          });

          if (result.requiresTwoFactor) {
            setError(result.message || "2FA code required. Enter your authenticator code to continue.");
            return;
          }
        } else {
          const response = await sendEmailOtpLogin({
            email: effectiveEmail,
          });
          setError("");
          submitToast("OTP sent", response.message || "OTP sent successfully.");
          return;
        }
      } else {
        const result = await signIn({
          email: email.trim().toLowerCase(),
          password,
        });

        if (result.requiresTwoFactor) {
          setError(result.message || "2FA code required. Enter your authenticator code to continue.");
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
      const normalizedBackendMessage = backendMessage.trim();
      const normalizedFallbackMessage = getFriendlyAuthError(requestError);
      const normalizedMessageSource = (normalizedBackendMessage || normalizedFallbackMessage || "").toLowerCase();

      if (requestError instanceof ApiRequestError && requestError.status === 401) {
        if (showTwoFactorStep) {
          if (
            normalizedMessageSource.includes("invalid two-factor") ||
            normalizedMessageSource.includes("invalid two factor") ||
            normalizedMessageSource.includes("invalid authenticator") ||
            normalizedMessageSource.includes("backup code")
          ) {
            setError("Invalid 2FA code. Please try again.");
          } else if (
            normalizedMessageSource.includes("expired") ||
            normalizedMessageSource.includes("invalid or expired") ||
            normalizedMessageSource.includes("session")
          ) {
            clearTwoFactorChallenge();
            setTwoFactorCode("");
            setError("Session expired, please sign in again.");
          } else {
            setError(normalizedBackendMessage || "Invalid 2FA code. Please try again.");
          }
        } else if (showEmailOtpStep || usingEmailOtpFlow) {
          setError(normalizedBackendMessage || "Invalid OTP.");
        } else {
          setError(normalizedBackendMessage || "Invalid email or password.");
        }
      } else if (showTwoFactorStep && normalizedMessageSource.includes("code required")) {
        setError("2FA code required. Enter your authenticator code to continue.");
      } else {
        setError(normalizedBackendMessage || normalizedFallbackMessage);
      }
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
        setError(result.message || "2FA code required. Enter your authenticator code to continue.");
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

  const canResendVerification = !showTwoFactorStep && !usingEmailOtpFlow && error.toLowerCase().includes("verify your email");

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

  if (authState === "loading") {
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

  if (authState === "authenticated") {
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
              value={effectiveEmail}
              onChange={(event) => {
                setEmail(event.target.value);
                if (!showEmailOtpStep) {
                  clearTwoFactorChallenge();
                }
                setError("");
              }}
              type="email"
              placeholder="Email"
              autoComplete="email"
              required
              disabled={showTwoFactorStep || showEmailOtpStep}
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white"
            />

            {!usingEmailOtpFlow && !showTwoFactorStep ? (
              <input
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  clearTwoFactorChallenge();
                  setError("");
                }}
                type="password"
                placeholder="Password"
                autoComplete="current-password"
                required
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white"
              />
            ) : null}

            {showEmailOtpStep ? (
              <>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-muted">
                  Enter the 6-digit code sent to {emailOtpChallenge?.email}.
                </div>
                <input
                  value={emailOtpCode}
                  onChange={(event) => setEmailOtpCode(event.target.value)}
                  type="text"
                  autoComplete="one-time-code"
                  placeholder="6-digit OTP"
                  required
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white"
                />
              </>
            ) : null}

            {showTwoFactorStep ? (
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
              {busy
                ? "Please wait..."
                : showTwoFactorStep
                  ? "Verify and sign in"
                  : usingEmailOtpFlow
                    ? showEmailOtpStep
                      ? "Verify OTP and sign in"
                      : "Send OTP"
                    : "Sign in"}
            </Button>

            {showTwoFactorStep ? (
              <Button className="w-full" type="button" variant="secondary" disabled={busy} onClick={usePasswordMode}>
                Use different credentials
              </Button>
            ) : null}

            {!showTwoFactorStep ? (
              <Button
                className="w-full"
                type="button"
                variant="secondary"
                disabled={busy || googleBusy}
                onClick={usingEmailOtpFlow ? usePasswordMode : useEmailOtpMode}
              >
                {usingEmailOtpFlow ? "Use email and password" : "Login with Email OTP"}
              </Button>
            ) : null}

            {isFirebaseClientConfigured && !showTwoFactorStep && !usingEmailOtpFlow ? (
              <Button
                className="w-full"
                type="button"
                variant="secondary"
                disabled={googleBusy || busy}
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
