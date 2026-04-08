"use client";

import Link from "next/link";
import { ContentSection, PageHero } from "@/components/PageShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { BRAND_NAME } from "@/lib/brand";
import { useDemo } from "@/lib/demo-provider";

export default function SignupPage() {
  const { submitToast } = useDemo();

  return (
    <>
      <PageHero eyebrow="Create account" title={`Open your ${BRAND_NAME} account in minutes`} description="Register with email or phone, review legal notices, and begin with a demo-safe balance and protected onboarding flow." />
      <ContentSection>
        <div className="mx-auto max-w-xl">
          <Card>
            <div className="space-y-4">
              <input placeholder="Full name" className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white" />
              <input placeholder="Email or phone" className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white" />
              <input placeholder="Password" type="password" className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white" />
              <label className="flex items-start gap-3 text-sm text-muted"><input type="checkbox" className="mt-1" />I agree to the Terms, Privacy Policy, and Risk Disclosure.</label>
              <Button className="w-full" onClick={() => submitToast("Account created", "Demo onboarding complete. Continue to identity verification or markets.")}>Create account</Button>
              <p className="text-sm text-muted">Already registered? <Link href="/login" className="text-accent">Sign in</Link></p>
            </div>
          </Card>
        </div>
      </ContentSection>
    </>
  );
}
