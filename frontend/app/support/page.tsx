import { ContentSection, PageHero } from "@/components/PageShell";
import { Card } from "@/components/ui/Card";

export default function SupportPage() {
  return (
    <>
      <PageHero eyebrow="Support" title="Help center, issue reporting, and contact options" description="Search help content, submit tickets, review common issues, and expose responsive support channels with risk-aware language." badge="24/7 help desk" />
      <ContentSection>
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <Card>
            <input placeholder="Search help center" className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white" />
            <div className="mt-6 space-y-3 text-sm text-muted">
              <p>Deposit delays</p>
              <p>Withdrawal review</p>
              <p>2FA reset</p>
              <p>KYC troubleshooting</p>
            </div>
          </Card>
          <Card>
            <div className="grid gap-4 md:grid-cols-2">
              <input placeholder="Subject" className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white" />
              <select className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white"><option>Wallet</option><option>Security</option><option>Trading</option></select>
            </div>
            <textarea placeholder="Describe your issue" className="mt-4 h-32 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white" />
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {["Live chat", "Email support", "Priority ticket queue"].map((item) => (
                <div key={item} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-muted">{item}</div>
              ))}
            </div>
          </Card>
        </div>
      </ContentSection>
    </>
  );
}

