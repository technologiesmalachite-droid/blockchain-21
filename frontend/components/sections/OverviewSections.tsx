import Link from "next/link";
import { ArrowUpRight, Landmark, LockKeyhole, Newspaper, Smartphone, TowerControl, TriangleAlert } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { featuredCoins, faqItems, newsItems, securityPillars, stakingOffers, whyChooseUs } from "@/data/demo";
import { BRAND_NAME } from "@/lib/brand";

export function FeaturedGrid() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 lg:px-8">
      <SectionTitle eyebrow="Assets" title="Featured cryptocurrencies" copy="Trade deep-liquidity majors and emerging ecosystem leaders inside a clean, risk-aware interface." />
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {featuredCoins.map((coin) => (
          <Card key={coin.symbol}>
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-sm font-bold text-white">{coin.symbol}</div>
            <p className="text-lg font-semibold text-white">{coin.name}</p>
            <p className="mt-3 text-sm leading-7 text-muted">{coin.blurb}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}

export function WhyChooseUsSection() {
  const icons = [LockKeyhole, TowerControl, Landmark];

  return (
    <section className="mx-auto max-w-7xl px-4 py-20 lg:px-8">
      <SectionTitle eyebrow={`Why ${BRAND_NAME}`} title="Professional-grade product architecture with trust-first design" />
      <div className="grid gap-6 lg:grid-cols-3">
        {whyChooseUs.map((item, index) => {
          const Icon = icons[index];
          return (
            <Card key={item.title}>
              <Icon className="h-10 w-10 text-accent" />
              <p className="mt-6 text-xl font-semibold text-white">{item.title}</p>
              <p className="mt-3 text-sm leading-7 text-muted">{item.copy}</p>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

export function SecuritySection() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 lg:px-8">
      <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <Card className="bg-gradient-to-br from-emerald-500/10 to-transparent">
          <p className="text-sm uppercase tracking-[0.24em] text-accent">Security</p>
          <h3 className="mt-4 text-3xl font-semibold text-white">Risk controls and compliance surfaces built into the core product.</h3>
          <p className="mt-4 text-sm leading-7 text-muted">
            We surface warnings, account protection tools, KYC workflows, review queues, and wallet notices throughout the experience.
          </p>
          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-gold/20 bg-gold/10 p-4 text-sm text-gold">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            Crypto trading involves risk, market volatility, and operational considerations. Historical values do not represent guaranteed returns.
          </div>
        </Card>
        <div className="grid gap-4 sm:grid-cols-2">
          {securityPillars.map((item) => (
            <Card key={item} className="p-5">
              <p className="text-sm leading-7 text-white">{item}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

export function PromoRail() {
  return (
    <section className="mx-auto grid max-w-7xl gap-6 px-4 py-20 lg:grid-cols-3 lg:px-8">
      <Card>
        <Smartphone className="h-8 w-8 text-accent" />
        <p className="mt-5 text-xl font-semibold text-white">Trade anywhere</p>
        <p className="mt-3 text-sm leading-7 text-muted">App-ready layouts, responsive watchlists, and portfolio actions optimized for mobile and tablet.</p>
      </Card>
      <Card>
        <Landmark className="h-8 w-8 text-gold" />
        <p className="mt-5 text-xl font-semibold text-white">Earn on idle assets</p>
        <p className="mt-3 text-sm leading-7 text-muted">Flexible and locked staking previews with APY cards, calculators, and clear terms.</p>
      </Card>
      <Card>
        <TowerControl className="h-8 w-8 text-accent" />
        <p className="mt-5 text-xl font-semibold text-white">Institutional and API ready</p>
        <p className="mt-3 text-sm leading-7 text-muted">Dedicated teasers for API access, analytics, and account structures for larger trading operations.</p>
      </Card>
    </section>
  );
}

export function EarnSection() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 lg:px-8">
      <SectionTitle eyebrow="Earn" title="Stake assets with flexible or fixed terms" action={<Link href="/earn" className="text-sm text-accent">View programs <ArrowUpRight className="ml-1 inline h-4 w-4" /></Link>} />
      <div className="grid gap-6 md:grid-cols-3">
        {stakingOffers.map((offer) => (
          <Card key={`${offer.asset}-${offer.term}`}>
            <p className="text-sm text-muted">{offer.asset}</p>
            <p className="mt-3 text-2xl font-semibold text-white">{offer.apy}</p>
            <p className="mt-2 text-sm text-muted">{offer.term} term</p>
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-muted">Minimum subscription: {offer.min}</div>
          </Card>
        ))}
      </div>
    </section>
  );
}

export function NewsFaqSection() {
  return (
    <section className="mx-auto grid max-w-7xl gap-8 px-4 py-20 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
      <div>
        <SectionTitle eyebrow="Research" title="Latest insights and product updates" />
        <div className="space-y-4">
          {newsItems.map((item) => (
            <Card key={item.title} className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-accent">{item.category}</p>
                <p className="mt-2 text-lg font-medium text-white">{item.title}</p>
              </div>
              <Newspaper className="h-5 w-5 text-muted" />
            </Card>
          ))}
        </div>
      </div>
      <div>
        <SectionTitle eyebrow="FAQ" title="Answers for common platform questions" />
        <div className="space-y-4">
          {faqItems.map((item) => (
            <Card key={item.q}>
              <p className="text-lg font-medium text-white">{item.q}</p>
              <p className="mt-3 text-sm leading-7 text-muted">{item.a}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
