"use client";

import { useEffect, useState } from "react";
import { fetchMarketsSnapshot } from "@/lib/markets/client";
import { formatSignedPercent, percentTextColor } from "@/lib/markets/format";

type TickerCoin = {
  symbol: string;
  change24h: number;
  currentPriceUsd: number;
};

function formatTickerPrice(value: number) {
  const decimals = value >= 1000 ? 2 : value >= 1 ? 3 : 6;
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(value);
}

const fallbackTickerItems = [
  "Loading live BTC/ETH/SOL market feed...",
  "Price stream reconnects automatically",
  "Market data refresh every 45 seconds",
];

export function MarketTicker() {
  const [items, setItems] = useState<TickerCoin[]>([]);

  useEffect(() => {
    let isMounted = true;
    let intervalId: number | undefined;

    const load = async () => {
      try {
        const snapshot = await fetchMarketsSnapshot();
        if (!isMounted) return;

        const next = [...snapshot.items]
          .sort((a, b) => b.volume24hUsd - a.volume24hUsd)
          .slice(0, 10)
          .map((item) => ({
            symbol: item.symbol,
            change24h: item.change24h,
            currentPriceUsd: item.currentPriceUsd,
          }));

        if (next.length > 0) {
          setItems(next);
        }
      } catch {
      }
    };

    load();
    intervalId = window.setInterval(load, 45000);

    return () => {
      isMounted = false;
      if (intervalId) {
        window.clearInterval(intervalId);
      }
    };
  }, []);

  return (
    <div className="overflow-hidden border-y border-white/10 bg-black/20">
      <div className="animate-[marquee_30s_linear_infinite] whitespace-nowrap py-3 text-sm text-muted">
        {items.length > 0
          ? items.concat(items).map((item, index) => (
              <span key={`${item.symbol}-${index}`} className="mx-6 inline-flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${item.change24h >= 0 ? "bg-emerald-400" : "bg-rose-400"}`} />
                <span className="text-white">{item.symbol}</span>
                <span>${formatTickerPrice(item.currentPriceUsd)}</span>
                <span className={percentTextColor(item.change24h)}>{formatSignedPercent(item.change24h)}</span>
              </span>
            ))
          : fallbackTickerItems.concat(fallbackTickerItems).map((item, index) => (
              <span key={`${item}-${index}`} className="mx-6 inline-flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-accent" />
                {item}
              </span>
            ))}
      </div>
    </div>
  );
}
