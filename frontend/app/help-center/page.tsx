import { ContentSection, PageHero } from "@/components/PageShell";
import { Card } from "@/components/ui/Card";

export default function HelpCenterPage() {
  return (
    <>
      <PageHero
        eyebrow="Help Center"
        title="Find answers for account, wallet, and trading questions"
        description="Browse support topics for onboarding, security, deposits, withdrawals, and order management."
        badge="Support resources"
      />
      <ContentSection>
        <Card>
          <p className="text-lg font-semibold text-white">Help articles and troubleshooting content are available in this support center preview.</p>
          <p className="mt-3 text-sm leading-7 text-muted">
            Explore account recovery, security best practices, and operational guidance. For urgent issues, use the contact and support pages.
          </p>
        </Card>
      </ContentSection>
    </>
  );
}
