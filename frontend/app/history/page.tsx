"use client";

import { ContentSection, PageHero } from "@/components/PageShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useDemo } from "@/lib/demo-provider";

export default function HistoryPage() {
  const { transactions } = useDemo();
  return (
    <>
      <PageHero eyebrow="History" title="Transaction history across deposits, withdrawals, trades, and transfers" description="Filter by status and date, review operational events, and export your activity as CSV in a production-style reporting surface." badge="CSV export placeholder" />
      <ContentSection>
        <Card>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex gap-3">
              <select className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white"><option>All statuses</option><option>Completed</option><option>Under review</option></select>
              <input type="date" className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white" />
            </div>
            <Button variant="secondary">Export CSV</Button>
          </div>
          <div className="space-y-3">
            {transactions.map((item) => (
              <div key={item.id} className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm md:grid-cols-5">
                <span className="text-white">{item.type}</span>
                <span className="text-muted">{item.asset}</span>
                <span className="text-muted">{item.amount}</span>
                <span className="text-muted">{item.status}</span>
                <span className="text-muted">{item.date}</span>
              </div>
            ))}
          </div>
        </Card>
      </ContentSection>
    </>
  );
}
