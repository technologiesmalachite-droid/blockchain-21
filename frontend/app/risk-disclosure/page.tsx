import { ContentSection, PageHero } from "@/components/PageShell";
import { Card } from "@/components/ui/Card";

export default function RiskDisclosurePage() {
  return (
    <>
      <PageHero eyebrow="Legal" title="Risk disclosure" description="Understand market volatility, liquidity risk, custody assumptions, operational delays, and limits to historical performance interpretation." />
      <ContentSection>
        <Card>
          <div className="space-y-6 text-sm leading-8 text-muted">
            <p>
              Digital asset prices can move rapidly and without warning. You may lose part or all of the value of assets held or traded through the platform.
            </p>
            <p>
              Execution risk includes slippage, partial fills, order rejection, and temporary liquidity gaps. Stop and conditional logic may not execute at the expected price during extreme volatility.
            </p>
            <p>
              Blockchain settlement risk includes chain reorganizations, delayed confirmations, network congestion, and third-party validator outages. Deposits and withdrawals may require extended confirmation windows.
            </p>
            <p>
              Operational controls such as KYC checks, sanctions screening, and account restrictions can delay access to funds, trading, or withdrawals while investigations are in progress.
            </p>
            <p>
              Past performance, historical charts, and projected yields are informational only and do not guarantee future returns.
            </p>
          </div>
        </Card>
      </ContentSection>
    </>
  );
}
