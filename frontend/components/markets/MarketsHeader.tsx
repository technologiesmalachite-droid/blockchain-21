import { Activity, ShieldCheck, TimerReset } from "lucide-react";
import { Card } from "@/components/ui/Card";

type MarketsHeaderProps = {
  updatedAt?: string;
  refreshing: boolean;
};

export function MarketsHeader({ updatedAt, refreshing }: MarketsHeaderProps) {
  const updatedLabel = updatedAt
    ? new Intl.DateTimeFormat("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(new Date(updatedAt))
    : "Fetching";

  return (
    <Card className="p-8">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="max-w-3xl">
          <p className="text-sm uppercase tracking-[0.24em] text-accent">Markets</p>
          <h1 className="mt-3 text-4xl font-semibold text-white md:text-5xl">Global Crypto Markets</h1>
          <p className="mt-4 text-sm leading-7 text-muted">
            Explore hundreds of assets with real-time market snapshots, watchlist tooling, pair-level filters, and
            exchange-style discovery workflows.
          </p>
        </div>
        <div className="grid gap-3 text-sm">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-muted">
            <TimerReset className="h-4 w-4" />
            Updated {updatedLabel}
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-muted">
            <Activity className="h-4 w-4" />
            {refreshing ? "Refreshing prices" : "Auto refresh every 45s"}
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-muted">
            <ShieldCheck className="h-4 w-4" />
            Public market data with server-side cache
          </div>
        </div>
      </div>
    </Card>
  );
}

