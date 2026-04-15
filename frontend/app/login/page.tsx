"use client";

import Link from "next/link";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ContentSection, PageHero } from "@/components/PageShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useDemo } from "@/lib/demo-provider";
import { getFriendlyAuthError, useAuth } from "@/lib/auth-provider";
import { readSession } from "@/lib/auth/session-store";

const shouldRedirectToVerification = (kycStatus: string | undefined, emailVerified: boolean | undefined, phoneVerified: boolean | undefined) => {
  const status = (kycStatus || "").toLowerCase();
  if (status === "approved") {
    return false;
  }

  if (!emailVerified || !phoneVerified) {
    return true;
  }

  return status !== "approved";
};

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}

function LoginPageContent() {
  const { submitToast } = useDemo();
  const { signIn, signInWithGoogle, resendEmailVerification, status } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const [error, setError] = useState("");

  const rawNextPath = searchParams.get("next");
  const nextPath = rawNextPath && rawNextPath.startsWith("/") ? rawNextPath : "/wallet";

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }

    router.replace(nextPath);
  }, [nextPath, router, status]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setBusy(true);
    setError("");

    try {
      await signIn({ email, password, twoFactorCode: twoFactorCode.trim() || undefined });
      submitToast("Signed in", "Session is active. Continue to trading, wallet, and onboarding workflows.");

      const session = readSession();
      const requiresVerification = shouldRedirectToVerification(
        session?.user?.kycStatus,
        session?.user?.emailVerified,
        session?.user?.phoneVerified,
      );

      router.replace(requiresVerification ? "/kyc" : nextPath);
    } catch (requestError) {
      setError(getFriendlyAuthError(requestError));
    } finally {
      setBusy(false);
    }
  };

  const onContinueWithGoogle = async () => {
    setGoogleBusy(true);
    setError("");

    try {
      await signInWithGoogle();
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
      setError(getFriendlyAuthError(requestError));
    } finally {
      setGoogleBusy(false);
    }
  };

  const canResendVerification = error.toLowerCase().includes("verify your email");

  const onResendVerification = async () => {
    setResendBusy(true);
    setError("");

    try {
      await resendEmailVerification();
      submitToast("Verification email sent", "Please check your inbox and verify your email before signing in.");
    } catch (requestError) {
      setError(getFriendlyAuthError(requestError));
    } finally {
      setResendBusy(false);
    }
  };

  return (
    <>
      <PageHero
        eyebrow="Authentication"
        title="Sign in to your account"
        description="Secure login with optional two-factor verification and device-aware session controls."
      />
      <ContentSection>
        <div className="mx-auto max-w-xl">
          <Card>
            <form className="space-y-4" onSubmit={onSubmit}>
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                placeholder="Email"
                autoComplete="email"
                required
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white"
              />
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                placeholder="Password"
                autoComplete="current-password"
                required
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white"
              />
              <input
                value={twoFactorCode}
                onChange={(event) => setTwoFactorCode(event.target.value)}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="2FA code (if enabled)"
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white"
              />
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-muted">
                Two-factor codes are required on accounts with elevated security policy enabled.
              </div>
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
                {busy ? "Signing in..." : "Sign in"}
              </Button>
              <Button className="w-full" type="button" variant="secondary" disabled={googleBusy || busy} onClick={onContinueWithGoogle}>
                {googleBusy ? "Connecting..." : "Continue with Google"}
              </Button>
              <div className="flex items-center justify-between text-sm text-muted">
                <Link href={`/signup${nextPath ? `?next=${encodeURIComponent(nextPath)}` : ""}`}>Create account</Link>
                <button type="button">Forgot password?</button>
              </div>
            </form>
          </Card>
        </div>
      </ContentSection>
    </>
  );
}
