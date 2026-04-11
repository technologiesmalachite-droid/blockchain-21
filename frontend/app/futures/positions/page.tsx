import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { OpenPositionsPanel } from "@/components/futures/OpenPositionsPanel";
import { ContentSection, PageHero } from "@/components/PageShell";

export default function FuturesPositionsPage() {
  return (
    <>
      <PageHero
        eyebrow="Futures"
        title="Open futures positions"
        description="Review and monitor your active futures exposure, order direction, and status in one place."
        badge="Private page"
      />
      <ContentSection>
        <ProtectedRoute>
          <OpenPositionsPanel />
        </ProtectedRoute>
      </ContentSection>
    </>
  );
}
