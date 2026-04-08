import { ContentSection, PageHero } from "@/components/PageShell";
import { Card } from "@/components/ui/Card";
import { stakingOffers } from "@/data/demo";

export default function EarnPage() {
  return (
    <>
      <PageHero eyebrow="Earn" title="Grow idle crypto balances through flexible and locked staking programs" description="Review APY offers, compare terms, estimate projected rewards, and subscribe through a clean modal-style flow." badge="Estimated yields only" />
      <ContentSection>
        <div className="grid gap-6 lg:grid-cols-[1fr_0.7fr]">
          <div className="grid gap-6 md:grid-cols-2">
            {stakingOffers.map((offer) => (
              <Card key={`${offer.asset}-${offer.term}`}>
                <p className="text-sm text-muted">{offer.asset}</p>
                <p className="mt-3 text-3xl font-semibold text-white">{offer.apy}</p>
                <p className="mt-2 text-sm text-muted">{offer.term} subscription</p>
                <div className="mt-6 space-y-2 text-sm text-muted">
                  <p>Minimum: {offer.min}</p>
                  <p>Settlement: Daily rewards estimate</p>
                  <p>Redemption: Subject to program rules</p>
                </div>
              </Card>
            ))}
          </div>
          <Card>
            <p className="text-lg font-semibold text-white">Earnings calculator</p>
            <div className="mt-5 space-y-4">
              <input defaultValue="1000" className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white" />
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-muted">
                Estimated annual reward: 114 USDT based on a sample 11.4% APY program.
              </div>
              <div className="rounded-2xl border border-gold/20 bg-gold/10 p-4 text-sm text-gold">
                Staking involves protocol, market, liquidity, and operational risks. Returns are not guaranteed.
              </div>
            </div>
          </Card>
        </div>
      </ContentSection>
    </>
  );
}

