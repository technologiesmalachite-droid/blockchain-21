"use client";

import Link from "next/link";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ContentSection } from "@/components/PageShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { forgotPasswordRequest } from "@/lib/api/auth";
import { extractBackendErrorMessage } from "@/lib/auth/error-messages";
import { useAuth } from "@/lib/auth-provider";

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ForgotPasswordContent />
    </Suspense>
  );
}

function ForgotPasswordContent() {
  const { status } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/profile");
    }
  }, [router, status]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) {
      return;
    }

    setBusy(true);
    setError("");
    setSuccess("");

    try {
      const response = await forgotPasswordRequest({ email: email.trim().toLowerCase() });
      setSuccess(response.message);
    } catch (requestError) {
      setError(extractBackendErrorMessage(requestError) || "Unable to request password reset.");
    } finally {
      setBusy(false);
    }
  };

  const showBlockingState = status === "loading" || status === "authenticated";

  return (
    <ContentSection>
      <div className="mx-auto flex min-h-[calc(100vh-17rem)] w-full max-w-xl items-center justify-center py-4">
        <Card className="w-full rounded-[2rem] border-white/15 bg-gradient-to-b from-slate-950/95 via-slate-950/90 to-black/95 p-8 shadow-[0_30px_80px_rgba(0,0,0,0.5)]">
          <div className="space-y-2 text-center">
            <p className="text-xs uppercase tracking-[0.24em] text-accent">Security</p>
            <h1 className="text-3xl font-semibold text-white">Reset your password</h1>
            <p className="text-sm leading-6 text-muted">
              Enter your account email and we will issue password reset instructions.
            </p>
          </div>

          {showBlockingState ? (
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5 text-center">
              <p className="text-base font-semibold text-white">
                {status === "loading" ? "Checking your session..." : "Redirecting to your account..."}
              </p>
            </div>
          ) : (
            <form className="mt-6 space-y-4" onSubmit={onSubmit}>
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                placeholder="Email"
                autoComplete="email"
                required
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white"
              />
              {error ? <p className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p> : null}
              {success ? <p className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">{success}</p> : null}
              <Button className="w-full" type="submit" disabled={busy}>
                {busy ? "Submitting..." : "Send reset instructions"}
              </Button>
              <p className="text-sm text-muted">
                Remembered your password?{" "}
                <Link href="/login" className="text-accent">
                  Sign in
                </Link>
              </p>
            </form>
          )}
        </Card>
      </div>
    </ContentSection>
  );
}

