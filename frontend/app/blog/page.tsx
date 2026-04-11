import { ContentSection, PageHero } from "@/components/PageShell";
import { Card } from "@/components/ui/Card";

export default function BlogPage() {
  return (
    <>
      <PageHero
        eyebrow="Blog"
        title="Exchange updates and market insights"
        description="Read product announcements, market commentary, and release notes from the MalachiteX team."
        badge="Editorial hub"
      />
      <ContentSection>
        <div className="space-y-4">
          {["Weekly market recap", "Security product updates", "Platform release highlights"].map((item) => (
            <Card key={item}>
              <p className="text-lg font-semibold text-white">{item}</p>
              <p className="mt-2 text-sm text-muted">This blog entry is represented as a structured placeholder for CMS-backed content publishing.</p>
            </Card>
          ))}
        </div>
      </ContentSection>
    </>
  );
}
