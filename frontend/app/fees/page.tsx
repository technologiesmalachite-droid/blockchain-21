import { ContentSection, PageHero } from "@/components/PageShell";
import { Card } from "@/components/ui/Card";
import { feeRows } from "@/data/demo";

export default function FeesPage() {
  return (
    <>
      <PageHero eyebrow="Fees" title="Transparent spot fee tiers and fee calculator" description="Review maker and taker schedules, understand transaction costs, and preview fee-aware order economics." />
      <ContentSection>
        <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
          <Card>
            {feeRows.map((row) => (
              <div key={row.tier} className="grid grid-cols-3 border-b border-white/10 py-4 text-sm last:border-none">
                <span className="text-white">{row.tier}</span>
                <span className="text-muted">Maker {row.maker}</span>
                <span className="text-muted">Taker {row.taker}</span>
              </div>
            ))}
          </Card>
          <Card>
            <p className="text-lg font-semibold text-white">Fee calculator</p>
            <div className="mt-4 space-y-4">
              <input defaultValue="2500" className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white" />
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-muted">Estimated fee at 0.10%: 2.50 USDT</div>
            </div>
          </Card>
        </div>
      </ContentSection>
    </>
  );
}
