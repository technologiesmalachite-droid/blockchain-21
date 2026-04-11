import Link from "next/link";
import { ContentSection, PageHero } from "@/components/PageShell";
import { OpenPositionsPanel } from "@/components/futures/OpenPositionsPanel";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default function FuturesPage() {
  return (
    <>
      <PageHero eyebrow="Futures" title="Advanced derivatives access with clear risk disclosure" description="This section provides a professional derivatives workspace with leverage education, operational warnings, and enablement controls." badge="Risk-managed access" />
      <ContentSection>
        <div className="grid gap-6 lg:grid-cols-3">
          {["Portfolio margin preview", "Perpetual contract analytics", "Funding and liquidation education"].map((item) => (
            <Card key={item}><p className="text-lg font-semibold text-white">{item}</p><p className="mt-3 text-sm text-muted">Professional futures-grade surface reserved for sandbox expansion.</p></Card>
          ))}
        </div>
        <div className="mt-6">
          <OpenPositionsPanel />
        </div>
        <Card className="mt-6 border-gold/20 bg-gold/10">
          <p className="text-sm text-gold">Risk disclosure: leveraged trading can result in rapid losses. Futures access should be enabled only for approved jurisdictions and suitable risk profiles.</p>
          <Link href="/signup" className="mt-4 inline-block"><Button>Enable futures access</Button></Link>
        </Card>
      </ContentSection>
    </>
  );
}
