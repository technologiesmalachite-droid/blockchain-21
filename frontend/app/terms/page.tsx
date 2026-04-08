import { ContentSection, PageHero } from "@/components/PageShell";
import { Card } from "@/components/ui/Card";

export default function TermsPage() {
  return (
    <>
      <PageHero eyebrow="Legal" title="Terms of service" description="Core platform usage terms, eligibility clauses, prohibited behaviors, and service limitations for a crypto exchange product." />
      <ContentSection><Card><p className="text-sm leading-8 text-muted">Placeholder legal content. Production deployment should include jurisdiction-specific counsel review.</p></Card></ContentSection>
    </>
  );
}

