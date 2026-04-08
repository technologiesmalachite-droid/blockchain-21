import { ContentSection, PageHero } from "@/components/PageShell";
import { Card } from "@/components/ui/Card";

export default function ApiDocsPage() {
  return (
    <>
      <PageHero eyebrow="API" title="Developer documentation placeholder for market, wallet, and trading APIs" description="Sandbox-first documentation layout prepared for authentication, rate limits, market streams, wallet operations, and institutional account tooling." badge="Coming soon" />
      <ContentSection>
        <div className="grid gap-6 md:grid-cols-2">
          {["Authentication", "Market data", "Order management", "WebSocket streams"].map((item) => (
            <Card key={item}><p className="text-lg font-semibold text-white">{item}</p><p className="mt-3 text-sm text-muted">Placeholder reference section for future developer docs expansion.</p></Card>
          ))}
        </div>
      </ContentSection>
    </>
  );
}

