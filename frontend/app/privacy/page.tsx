import { ContentSection, PageHero } from "@/components/PageShell";
import { Card } from "@/components/ui/Card";

export default function PrivacyPage() {
  return (
    <>
      <PageHero eyebrow="Legal" title="Privacy policy" description="Data handling, retention, account protection, and compliance disclosure for platform users and support processes." />
      <ContentSection><Card><p className="text-sm leading-8 text-muted">Placeholder privacy content. Production deployment should align with applicable privacy laws and internal controls.</p></Card></ContentSection>
    </>
  );
}

