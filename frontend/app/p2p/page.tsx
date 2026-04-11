import { ContentSection, PageHero } from "@/components/PageShell";
import { Card } from "@/components/ui/Card";

export default function P2PPage() {
  return (
    <>
      <PageHero
        eyebrow="P2P"
        title="Peer-to-peer trading marketplace"
        description="Create and take offers, settle with supported payment methods, and monitor counterparties in a secure P2P workflow."
        badge="Marketplace preview"
      />
      <ContentSection>
        <div className="grid gap-6 lg:grid-cols-3">
          {["Buy and sell offers", "Escrow and dispute flow", "Merchant reputation insights"].map((item) => (
            <Card key={item}>
              <p className="text-lg font-semibold text-white">{item}</p>
              <p className="mt-3 text-sm text-muted">P2P surfaces are available as a structured preview ready for backend settlement integration.</p>
            </Card>
          ))}
        </div>
      </ContentSection>
    </>
  );
}
