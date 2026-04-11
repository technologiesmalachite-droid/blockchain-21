import { ContentSection, PageHero } from "@/components/PageShell";
import { Card } from "@/components/ui/Card";

export default function TutorialsPage() {
  return (
    <>
      <PageHero
        eyebrow="Tutorials"
        title="Interactive tutorials for core workflows"
        description="Hands-on walkthroughs for spot trading, futures basics, and wallet operations."
        badge="Learning path"
      />
      <ContentSection>
        <div className="space-y-4">
          {["How to place your first spot order", "Intro to futures position management", "Deposit and withdrawal flow tutorial"].map((item) => (
            <Card key={item}>
              <p className="text-lg font-semibold text-white">{item}</p>
              <p className="mt-2 text-sm text-muted">Tutorial modules are scaffolded for video, text, and checklist delivery.</p>
            </Card>
          ))}
        </div>
      </ContentSection>
    </>
  );
}
