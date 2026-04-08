import { ContentSection, PageHero } from "@/components/PageShell";
import { Card } from "@/components/ui/Card";

export default function ReferralsPage() {
  return (
    <>
      <PageHero eyebrow="Referrals" title="Invite contacts and track referral rewards" description="Referral link placeholders, invite metrics, and reward cards designed as original acquisition surfaces." />
      <ContentSection>
        <div className="grid gap-6 md:grid-cols-3">
          {["Invite link", "Reward history", "Campaign tiers"].map((item) => (
            <Card key={item}><p className="text-lg font-semibold text-white">{item}</p><p className="mt-3 text-sm text-muted">Referral product module placeholder with compliance-aware messaging.</p></Card>
          ))}
        </div>
      </ContentSection>
    </>
  );
}

