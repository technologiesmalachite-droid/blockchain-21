import Link from "next/link";
import { Flame, LineChart, Sparkles, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { CryptoIcon } from "@/components/markets/CryptoIcon";
import { MarketsOverview } from "@/lib/markets/types";
import { formatCompactUsd, formatSignedPercent, percentTextColor } from "@/lib/markets/format";

type MarketSummaryCardsProps = {
  overview: MarketsOverview | null;
  loading: boolean;
};

function SkeletonCard() {
  return (
    <Card>
      <div className="space-y-3">
        <div className="h-5 w-1/3 animate-pulse rounded bg-white/10" />
        <div className="h-7 w-2/3 animate-pulse rounded bg-white/10" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-white/10" />
      </div>
    </Card>
  );
}

export function MarketSummaryCards({ overview, loading }: MarketSummaryCardsProps) {
  if (loading || !overview) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <SkeletonCard key={index} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted">Market cap</p>
          <LineChart className="h-4 w-4 text-accent" />
        </div>
        <p className="mt-3 text-2xl font-semibold text-white">{formatCompactUsd(overview.totalMarketCapUsd)}</p>
        <p className={`mt-2 text-sm ${percentTextColor(overview.marketCapChange24h)}`}>
          {formatSignedPercent(overview.marketCapChange24h)} 24h
        </p>
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted">24h volume</p>
          <TrendingUp className="h-4 w-4 text-accent" />
        </div>
        <p className="mt-3 text-2xl font-semibold text-white">{formatCompactUsd(overview.totalVolumeUsd)}</p>
        <p className="mt-2 text-sm text-muted">{overview.activeCryptocurrencies.toLocaleString()} active assets</p>
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted">Hot coins</p>
          <Flame className="h-4 w-4 text-gold" />
        </div>
        <div className="mt-4 space-y-2">
          {overview.hotCoins.slice(0, 3).map((coin) => (
            <Link key={coin.id} href={`/markets/${coin.symbol.toLowerCase()}`} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <div className="flex items-center gap-2">
                <CryptoIcon symbol={coin.baseAsset || coin.symbol} src={coin.image} size={18} alt={`${coin.name} logo`} />
                <span className="text-sm text-white">{coin.symbol}</span>
              </div>
              <span className={`text-xs ${percentTextColor(coin.change24h)}`}>{formatSignedPercent(coin.change24h)}</span>
            </Link>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted">Trending</p>
          <Sparkles className="h-4 w-4 text-accent" />
        </div>
        <div className="mt-4 space-y-2">
          {overview.trending.slice(0, 3).map((coin) => (
            <Link key={coin.id} href={`/markets/${coin.symbol.toLowerCase()}`} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <span className="text-sm text-white">{coin.name}</span>
              <span className="text-xs text-muted">#{coin.rank}</span>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
