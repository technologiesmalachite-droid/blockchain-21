import { ContentSection, PageHero } from "@/components/PageShell";
import { Card } from "@/components/ui/Card";

export default function GuidesPage() {
  return (
    <>
      <PageHero
        eyebrow="Guides"
        title="Step-by-step product guides"
        description="Follow practical walkthroughs for onboarding, funding, trading execution, and account security."
        badge="How-to content"
      />
      <ContentSection>
        <div className="grid gap-6 md:grid-cols-2">
          {["Beginner onboarding guide", "Wallet funding and transfers", "Risk controls for active traders", "Security hardening checklist"].map((item) => (
            <Card key={item}>
              <p className="text-lg font-semibold text-white">{item}</p>
              <p className="mt-2 text-sm text-muted">Guide content is available as a production-ready placeholder linked from the Resources footer section.</p>
            </Card>
          ))}
        </div>
      </ContentSection>
    </>
  );
}
