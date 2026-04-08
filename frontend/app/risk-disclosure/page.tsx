import { ContentSection, PageHero } from "@/components/PageShell";
import { Card } from "@/components/ui/Card";

export default function RiskDisclosurePage() {
  return (
    <>
      <PageHero eyebrow="Legal" title="Risk disclosure" description="Understand market volatility, liquidity risk, custody assumptions, operational delays, and the limits of simulated performance data." />
      <ContentSection><Card><p className="text-sm leading-8 text-muted">Trading, staking, and transfers involve market and operational risk. Demo data shown across the platform does not imply real profit expectations.</p></Card></ContentSection>
    </>
  );
}

