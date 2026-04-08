import { ContentSection, PageHero } from "@/components/PageShell";
import { Card } from "@/components/ui/Card";

export default function KycPage() {
  return (
    <>
      <PageHero eyebrow="KYC" title="Multi-step identity verification and compliance review" description="Collect personal information, ID details, selfie capture placeholders, address proof, and visible submission status tracking." badge="Compliance flow" />
      <ContentSection>
        <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
          <Card>
            <div className="grid gap-4 md:grid-cols-2">
              <input placeholder="Legal name" className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white" />
              <input type="date" className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white" />
              <input placeholder="Nationality" className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white" />
              <select className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white"><option>Passport</option><option>National ID</option></select>
            </div>
            <textarea placeholder="Residential address" className="mt-4 h-28 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white" />
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="flex h-36 items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/5 text-sm text-muted">ID upload</div>
              <div className="flex h-36 items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/5 text-sm text-muted">Selfie upload</div>
            </div>
          </Card>
          <div className="space-y-6">
            <Card>
              <p className="text-lg font-semibold text-white">Verification status</p>
              <div className="mt-4 space-y-3 text-sm text-muted">
                <p>1. Personal information: Complete</p>
                <p>2. Identity upload: Pending</p>
                <p>3. Address proof: Pending</p>
                <p>4. Review outcome: Awaiting submission</p>
              </div>
            </Card>
            <Card>
              <p className="text-lg font-semibold text-white">Compliance notes</p>
              <p className="mt-4 text-sm leading-7 text-muted">Identity review helps prevent fraud, meet jurisdictional controls, and protect wallet operations.</p>
            </Card>
          </div>
        </div>
      </ContentSection>
    </>
  );
}

