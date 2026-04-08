"use client";

import Link from "next/link";
import { ContentSection, PageHero } from "@/components/PageShell";
import { PortfolioChart } from "@/components/trade/PortfolioChart";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useDemo } from "@/lib/demo-provider";
import { formatCurrency } from "@/lib/utils";

export default function WalletPage() {
  const { balances, transactions } = useDemo();
  return (
    <>
      <PageHero eyebrow="Wallet" title="Portfolio visibility, balances, and recent account activity" description="Track holdings, monitor PnL, review wallet events, and move into deposit or withdrawal flows from a dashboard-style interface." badge="Demo balances" />
      <ContentSection>
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm text-muted">Total portfolio balance</p>
                <p className="mt-2 text-4xl font-semibold text-white">{formatCurrency(101860)}</p>
              </div>
              <div className="flex gap-3">
                <Link href="/deposit"><Button>Deposit</Button></Link>
                <Link href="/withdraw"><Button variant="secondary">Withdraw</Button></Link>
              </div>
            </div>
            <div className="mt-6"><PortfolioChart /></div>
          </Card>
          <Card>
            <p className="text-lg font-semibold text-white">PnL summary</p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-sm text-muted">24h PnL</p><p className="mt-2 text-2xl font-semibold text-emerald-400">+$2,140</p></div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-sm text-muted">7d PnL</p><p className="mt-2 text-2xl font-semibold text-emerald-400">+$5,820</p></div>
            </div>
            <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-muted">Asset allocation: 46% BTC, 21% ETH, 19% USDT, 14% SOL.</div>
          </Card>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_0.9fr]">
          <Card>
            <p className="mb-4 text-lg font-semibold text-white">Holdings</p>
            <div className="space-y-3">
              {balances.map((asset) => (
                <div key={asset.asset} className="grid grid-cols-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
                  <span className="text-white">{asset.asset}</span>
                  <span className="text-muted">Available {asset.available}</span>
                  <span className="text-muted">Total {asset.total}</span>
                  <span className={asset.pnl >= 0 ? "text-emerald-400" : "text-rose-400"}>{asset.pnl}% PnL</span>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <p className="mb-4 text-lg font-semibold text-white">Recent transactions</p>
            <div className="space-y-3">
              {transactions.slice(0, 4).map((item) => (
                <div key={item.id} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
                  <div className="flex items-center justify-between"><span className="text-white">{item.type}</span><span className="text-muted">{item.date}</span></div>
                  <p className="mt-2 text-muted">{item.asset} | {item.amount} | {item.status}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </ContentSection>
    </>
  );
}
