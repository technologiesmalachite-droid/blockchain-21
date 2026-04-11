import Link from "next/link";
import { ArrowRight, Info, ShieldCheck, Sparkles, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { announcements, marketData } from "@/data/demo";
import { BRAND_NAME } from "@/lib/brand";
import { formatCurrency, percentClass } from "@/lib/utils";

export function HeroSection() {
  return (
    <section className="bg-hero-radial">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 lg:grid-cols-[1.2fr_0.8fr] lg:px-8 lg:py-24">
        <div>
          <Badge>Trusted exchange infrastructure for modern digital finance</Badge>
          <h1 className="mt-6 max-w-3xl text-5xl font-semibold leading-tight text-white lg:text-6xl">
            Buy, trade, and grow your digital assets securely.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted">
            {BRAND_NAME} is a premium crypto trading platform concept with spot execution, wallet operations, staking flows,
            admin controls, and original exchange-grade UX.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link href="/signup"><Button className="px-6 py-3">Get Started</Button></Link>
            <Link href="/trade"><Button variant="secondary" className="px-6 py-3">Trade Now <ArrowRight className="ml-2 h-4 w-4" /></Button></Link>
          </div>
          <div className="mt-8 flex flex-wrap gap-6 text-sm text-muted">
            <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-accent" /> Secure account controls</div>
            <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-gold" /> Original premium interface</div>
            <div className="flex items-center gap-2"><WalletCards className="h-4 w-4 text-accent" /> Live-ready wallet flows</div>
          </div>
        </div>
        <Card className="bg-gradient-to-b from-white/8 to-white/5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted">Top market snapshot</p>
              <p className="mt-2 text-3xl font-semibold text-white">{formatCurrency(marketData[0].lastPrice)}</p>
            </div>
            <Badge className={percentClass(marketData[0].change24h)}>{marketData[0].change24h > 0 ? "+" : ""}{marketData[0].change24h}% 24h</Badge>
          </div>
          <div className="mt-8 space-y-4">
            {marketData.slice(0, 4).map((coin) => (
              <div key={coin.symbol} className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <div>
                  <p className="font-medium text-white">{coin.pair}</p>
                  <p className="text-xs text-muted">{coin.symbol}</p>
                </div>
                <div className="text-right">
                  <p className="text-white">{formatCurrency(coin.lastPrice, coin.lastPrice > 1 ? 2 : 4)}</p>
                  <p className={`text-xs ${percentClass(coin.change24h)}`}>{coin.change24h}%</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 rounded-2xl border border-amber-200/20 bg-gradient-to-r from-amber-300/10 to-amber-200/5 px-4 py-3.5">
            <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-amber-200/80">
              <Info className="h-3.5 w-3.5 shrink-0" />
              Platform notice
            </div>
            <p className="mt-2 text-sm leading-6 text-amber-100/90">
              {announcements[0]}
            </p>
          </div>
        </Card>
      </div>
    </section>
  );
}
