"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ContentSection } from "@/components/PageShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { getFriendlyAuthError, useAuth } from "@/lib/auth-provider";
import { BRAND_NAME } from "@/lib/brand";
import { useDemo } from "@/lib/demo-provider";
import { isFirebaseClientConfigured } from "@/lib/firebase";
import { extractBackendErrorMessage } from "@/lib/auth/error-messages";
import { sanitizePostAuthPath } from "@/lib/auth/navigation";

const countries = [
  { code: "US", label: "United States" },
  { code: "IN", label: "India" },
  { code: "AE", label: "United Arab Emirates" },
  { code: "SG", label: "Singapore" },
];

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

type SignupPageClientProps = {
  rawNextPath?: string | null;
};

export function SignupPageClient({ rawNextPath }: SignupPageClientProps) {
  const { submitToast } = useDemo();
  const { signUp, signUpWithGoogle, authState, user } = useAuth();
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [countryCode, setCountryCode] = useState("US");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [error, setError] = useState("");

  const signupNextPath = useMemo(() => sanitizePostAuthPath(rawNextPath, "/kyc"), [rawNextPath]);
  const signedInNextPath = useMemo(() => sanitizePostAuthPath(rawNextPath, "/wallet"), [rawNextPath]);

  const authenticatedDestination = useMemo(() => {
    const requiresVerification = shouldRedirectToVerification(user?.kycStatus, user?.emailVerified, user?.phoneVerified);
    return requiresVerification ? "/kyc" : signedInNextPath;
  }, [signedInNextPath, user?.emailVerified, user?.kycStatus, user?.phoneVerified]);

  useEffect(() => {
    if (authState !== "authenticated") {
      return;
    }

    router.replace(authenticatedDestination);
  }, [authState, authenticatedDestination, router]);

  useEffect(() => {
    if (authState !== "two_factor_pending" && authState !== "email_otp_pending") {
      return;
    }

    router.replace(`/login${signedInNextPath ? `?next=${encodeURIComponent(signedInNextPath)}` : ""}`);
  }, [authState, router, signedInNextPath]);

  const canSubmit = useMemo(
    () => Boolean(fullName.trim() && email.trim() && phone.trim() && password && confirmPassword && termsAccepted && privacyAccepted),
    [confirmPassword, email, fullName, password, phone, privacyAccepted, termsAccepted],
  );

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (busy) {
      return;
    }

    setBusy(true);
    setError("");

    try {
      if (!canSubmit) {
        throw new Error("Please fill all required fields and accept Terms and Privacy Policy.");
      }

      if (password.length < 10) {
        throw new Error("Password must be at least 10 characters.");
      }

      if (password !== confirmPassword) {
        throw new Error("Password and confirmation do not match.");
      }

      await signUp({
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        countryCode,
        password,
        termsAccepted,
        privacyAccepted,
      });
      submitToast("Account created", "Check your email for a verification link, then complete KYC to unlock full trading and withdrawal access.");
      router.replace(signupNextPath);
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
      await signUpWithGoogle({
        countryCode,
        termsAccepted,
        privacyAccepted,
      });
      submitToast("Google account connected", "Account authenticated successfully.");
      router.replace(signupNextPath);
    } catch (requestError) {
      const backendMessage = extractBackendErrorMessage(requestError);
      setError(backendMessage || getFriendlyAuthError(requestError));
    } finally {
      setGoogleBusy(false);
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

  if (authState === "authenticated" || authState === "two_factor_pending" || authState === "email_otp_pending") {
    return (
      <ContentSection>
        <div className="mx-auto flex min-h-[calc(100vh-17rem)] w-full max-w-xl items-center justify-center py-4">
          <div className="w-full rounded-2xl border border-white/10 bg-white/5 p-5 text-center">
            <p className="text-base font-semibold text-white">Redirecting to your account...</p>
            <p className="mt-2 text-sm text-muted">
              {authState === "two_factor_pending"
                ? "Complete two-factor verification to continue."
                : authState === "email_otp_pending"
                  ? "Complete email OTP verification to continue."
                : "You are already signed in."}
            </p>
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
            <p className="text-xs uppercase tracking-[0.24em] text-accent">Create account</p>
            <h1 className="text-3xl font-semibold text-white">Open your {BRAND_NAME} account</h1>
            <p className="text-sm leading-6 text-muted">
              Create a secure account with compliance-ready onboarding and instant access to the MalachiteX ecosystem.
            </p>
          </div>

          <form className="mt-6 space-y-4" onSubmit={onSubmit} noValidate>
            <input
              placeholder="Full legal name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              required
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white"
            />
            <input
              placeholder="Email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white"
            />
            <div className="grid gap-4 md:grid-cols-2">
              <input
                placeholder="Phone number"
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                required
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white"
              />
              <select
                value={countryCode}
                onChange={(event) => setCountryCode(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white"
              >
                {countries.map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.label}
                  </option>
                ))}
              </select>
            </div>
            <input
              placeholder="Password (min 10 chars)"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={10}
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white"
            />
            <input
              placeholder="Confirm password"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              minLength={10}
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white"
            />
            <label className="flex items-start gap-3 text-sm text-muted">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(event) => setTermsAccepted(event.target.checked)}
                className="mt-1"
              />
              I accept the Terms of Service and consent to account risk controls.
            </label>
            <label className="flex items-start gap-3 text-sm text-muted">
              <input
                type="checkbox"
                checked={privacyAccepted}
                onChange={(event) => setPrivacyAccepted(event.target.checked)}
                className="mt-1"
              />
              I accept the Privacy Policy and data processing required for compliance screening.
            </label>
            {error ? <p className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p> : null}
            <Button className="w-full" type="submit" disabled={busy}>
              {busy ? "Creating account..." : "Create account"}
            </Button>
            {isFirebaseClientConfigured ? (
              <Button className="w-full" type="button" variant="secondary" disabled={googleBusy || busy} onClick={onContinueWithGoogle}>
                {googleBusy ? "Connecting..." : "Continue with Google"}
              </Button>
            ) : null}
            <p className="text-sm text-muted">
              Already registered?{" "}
              <Link href={`/login${signupNextPath ? `?next=${encodeURIComponent(signupNextPath)}` : ""}`} className="text-accent">
                Sign in
              </Link>
            </p>
          </form>
        </Card>
      </div>
    </ContentSection>
  );
}
