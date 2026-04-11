import { ContentSection, PageHero } from "@/components/PageShell";
import { Card } from "@/components/ui/Card";

export default function RiskDisclosurePage() {
  return (
    <>
      <PageHero eyebrow="Legal" title="Risk disclosure" description="Understand market volatility, liquidity risk, custody assumptions, operational delays, and limits to historical performance interpretation." />
      <ContentSection><Card><p className="text-sm leading-8 text-muted">Trading, staking, and transfers involve market and operational risk. Past performance and historical values do not guarantee future returns.</p></Card></ContentSection>
    </>
  );
}
