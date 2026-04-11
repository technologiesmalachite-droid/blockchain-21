import { PageHero, ContentSection } from "@/components/PageShell";
import { TradingDesk } from "@/components/trade/TradingDesk";

export default function TradePage() {
  return (
    <>
      <PageHero eyebrow="Spot Trading" title="Professional trading workspace for active digital asset execution" description="Switch between order types, monitor order flow, review execution history, and place market or limit orders with risk-aware controls." badge="Live trading workflow" />
      <ContentSection>
        <TradingDesk />
      </ContentSection>
    </>
  );
}
