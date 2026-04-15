"use client";

import Link from "next/link";
import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ContentSection, PageHero } from "@/components/PageShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { getFriendlyAuthError, useAuth } from "@/lib/auth-provider";
import { BRAND_NAME } from "@/lib/brand";
import { useDemo } from "@/lib/demo-provider";

const countries = [
  { code: "US", label: "United States" },
  { code: "IN", label: "India" },
  { code: "AE", label: "United Arab Emirates" },
  { code: "SG", label: "Singapore" },
];

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupPageContent />
    </Suspense>
  );
}

function SignupPageContent() {
  const { submitToast } = useDemo();
  const { signUp, signUpWithGoogle, status } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
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

  const rawNextPath = searchParams.get("next");
  const nextPath = rawNextPath && rawNextPath.startsWith("/") ? rawNextPath : "/kyc";

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }

    router.replace(nextPath);
  }, [nextPath, router, status]);

  const canSubmit = useMemo(
    () => Boolean(fullName && email && phone && password && confirmPassword && termsAccepted && privacyAccepted),
    [confirmPassword, email, fullName, password, phone, privacyAccepted, termsAccepted],
  );

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setBusy(true);
    setError("");

    try {
      if (password.length < 10) {
        throw new Error("Password must be at least 10 characters.");
      }

      if (password !== confirmPassword) {
        throw new Error("Password and confirmation do not match.");
      }

      await signUp({
        fullName,
        email,
        phone,
        countryCode,
        password,
        termsAccepted,
        privacyAccepted,
      });
      submitToast("Account created", "Check your email for a verification link, then complete KYC to unlock full trading and withdrawal access.");
      router.replace(nextPath);
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
      await signUpWithGoogle({
        countryCode,
        termsAccepted,
        privacyAccepted,
      });
      submitToast("Google account connected", "Account authenticated successfully.");
      router.replace(nextPath);
    } catch (requestError) {
      setError(getFriendlyAuthError(requestError));
    } finally {
      setGoogleBusy(false);
    }
  };

  return (
    <>
      <PageHero
        eyebrow="Create account"
        title={`Open your ${BRAND_NAME} account`}
        description="Create a secure account with jurisdiction-based onboarding, contact verification, and compliance-ready controls."
      />
      <ContentSection>
        <div className="mx-auto max-w-xl">
          <Card>
            <form className="space-y-4" onSubmit={onSubmit}>
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
              <Button className="w-full" type="submit" disabled={busy || !canSubmit}>
                {busy ? "Creating account..." : "Create account"}
              </Button>
              <Button className="w-full" type="button" variant="secondary" disabled={googleBusy || busy} onClick={onContinueWithGoogle}>
                {googleBusy ? "Connecting..." : "Continue with Google"}
              </Button>
              <p className="text-sm text-muted">
                Already registered?{" "}
                <Link href={`/login${nextPath ? `?next=${encodeURIComponent(nextPath)}` : ""}`} className="text-accent">
                  Sign in
                </Link>
              </p>
            </form>
          </Card>
        </div>
      </ContentSection>
    </>
  );
}
