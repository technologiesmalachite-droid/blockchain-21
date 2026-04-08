import { PageHero, ContentSection } from "@/components/PageShell";
import { TradingDesk } from "@/components/trade/TradingDesk";

export default function TradePage() {
  return (
    <>
      <PageHero eyebrow="Spot Trading" title="Professional trading workspace for active digital asset execution" description="Switch between order types, monitor the order book, review recent trades, and submit demo orders inside an exchange-style layout." badge="Demo execution only" />
      <ContentSection>
        <TradingDesk />
      </ContentSection>
    </>
  );
}

