"use client";

import Link from "next/link";
import { ContentSection, PageHero } from "@/components/PageShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useDemo } from "@/lib/demo-provider";

export default function LoginPage() {
  const { submitToast } = useDemo();

  return (
    <>
      <PageHero eyebrow="Authentication" title="Sign in with email or phone" description="Strong validation, OTP placeholders, session awareness, and a clean account access experience for retail and institutional users." />
      <ContentSection>
        <div className="mx-auto max-w-xl">
          <Card>
            <div className="space-y-4">
              <input defaultValue="trader@malachitex.exchange" className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white" />
              <input defaultValue="DemoTrader123!" type="password" className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white" />
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-muted">OTP verification and password reset UIs are designed as placeholders for backend integration.</div>
              <Button className="w-full" onClick={() => submitToast("Signed in", "Demo login flow completed. Session and device management are UI-ready.")}>Sign in</Button>
              <div className="flex items-center justify-between text-sm text-muted">
                <Link href="/signup">Create account</Link>
                <button>Forgot password?</button>
              </div>
            </div>
          </Card>
        </div>
      </ContentSection>
    </>
  );
}
