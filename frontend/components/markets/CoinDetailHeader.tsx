"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { CoinDetailResponse } from "@/lib/markets/types";
import { formatCompactUsd, formatSignedPercent, formatUsd, percentTextColor } from "@/lib/markets/format";
import { CryptoIcon } from "@/components/markets/CryptoIcon";
import { WatchlistToggle } from "@/components/markets/WatchlistToggle";
import { Card } from "@/components/ui/Card";

type CoinDetailHeaderProps = {
  detail: CoinDetailResponse;
  favorite: boolean;
  onToggleFavorite: () => void;
};

export function CoinDetailHeader({ detail, favorite, onToggleFavorite }: CoinDetailHeaderProps) {
  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="flex items-center gap-4">
          <CryptoIcon symbol={detail.symbol} src={detail.image} size={48} alt={`${detail.name} logo`} />
          <div>
            <p className="text-2xl font-semibold text-white">{detail.name}</p>
            <p className="text-sm text-muted">{detail.symbol.toUpperCase()} / USD</p>
          </div>
          <WatchlistToggle active={favorite} onToggle={onToggleFavorite} label={`Toggle ${detail.symbol} in watchlist`} />
        </div>

        <div className="grid gap-2 text-right">
          <p className="text-3xl font-semibold text-white">{formatUsd(detail.currentPriceUsd)}</p>
          <p className={`text-sm ${percentTextColor(detail.change24h)}`}>{formatSignedPercent(detail.change24h)} 24h</p>
          {detail.homepage ? (
            <Link
              href={detail.homepage}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-end gap-1 text-xs text-accent"
            >
              Official site
              <ExternalLink className="h-3 w-3" />
            </Link>
          ) : null}
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <p className="text-xs uppercase text-muted">24h High</p>
          <p className="mt-1 text-sm text-white">{formatUsd(detail.high24hUsd)}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <p className="text-xs uppercase text-muted">24h Low</p>
          <p className="mt-1 text-sm text-white">{formatUsd(detail.low24hUsd)}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <p className="text-xs uppercase text-muted">Market Cap</p>
          <p className="mt-1 text-sm text-white">{formatCompactUsd(detail.marketCapUsd)}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <p className="text-xs uppercase text-muted">24h Volume</p>
          <p className="mt-1 text-sm text-white">{formatCompactUsd(detail.volume24hUsd)}</p>
        </div>
      </div>
    </Card>
  );
}
