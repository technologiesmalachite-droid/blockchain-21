import { ContentSection, PageHero } from "@/components/PageShell";
import { Card } from "@/components/ui/Card";
import { BRAND_NAME } from "@/lib/brand";

export default function AboutPage() {
  return (
    <>
      <PageHero eyebrow="About" title="A modern crypto exchange platform with original product design" description={`${BRAND_NAME} is designed to feel global, secure, and premium while supporting production-grade exchange operations.`} />
      <ContentSection>
        <div className="grid gap-6 lg:grid-cols-3">
          {["Mission", "Trust model", "Platform roadmap"].map((item) => (
            <Card key={item}><p className="text-xl font-semibold text-white">{item}</p><p className="mt-3 text-sm text-muted">Detailed narrative section for institutional confidence, product strategy, and platform maturity.</p></Card>
          ))}
        </div>
      </ContentSection>
    </>
  );
}
