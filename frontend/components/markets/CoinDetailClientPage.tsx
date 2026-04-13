"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CoinDetailHeader } from "@/components/markets/CoinDetailHeader";
import { CryptoIcon } from "@/components/markets/CryptoIcon";
import { Card } from "@/components/ui/Card";
import { fetchCoinDetail, useWatchlist } from "@/lib/markets/client";
import { formatCompactUsd, formatSupply, formatUsd } from "@/lib/markets/format";
import { CoinDetailResponse } from "@/lib/markets/types";

type CoinDetailClientPageProps = {
  symbol: string;
  initialDetail: CoinDetailResponse;
};

const REFRESH_INTERVAL_MS = 45000;

export function CoinDetailClientPage({ symbol, initialDetail }: CoinDetailClientPageProps) {
  const [detail, setDetail] = useState<CoinDetailResponse>(initialDetail);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isFavorite, toggle } = useWatchlist();

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const next = await fetchCoinDetail(symbol);
      setDetail(next);
      setError(null);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Failed to refresh coin details.");
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      refresh();
    }, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [refresh]);

  const sparklineData = useMemo(
    () => detail.sparkline7d.map((value, index) => ({ index, value })),
    [detail.sparkline7d],
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-12 lg:px-8">
      <CoinDetailHeader detail={detail} favorite={isFavorite(detail.symbol)} onToggleFavorite={() => toggle(detail.symbol)} />

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-muted">7D price trend</p>
            <p className="text-xs text-muted">{loading ? "Refreshing..." : "Live snapshot"}</p>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparklineData}>
                <defs>
                  <linearGradient id="coin-detail-area" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#16C47F" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#16C47F" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="index" hide />
                <YAxis hide />
                <Tooltip
                  formatter={(value: number) => [formatUsd(value), "Price"]}
                  contentStyle={{ background: "#0F172A", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12 }}
                />
                <Area type="monotone" dataKey="value" stroke="#16C47F" strokeWidth={2.5} fill="url(#coin-detail-area)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="space-y-4 p-5">
          <h2 className="text-lg font-semibold text-white">Market stats</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-xs uppercase text-muted">Market cap</p>
              <p className="mt-1 text-white">{formatCompactUsd(detail.marketCapUsd)}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-xs uppercase text-muted">24h Volume</p>
              <p className="mt-1 text-white">{formatCompactUsd(detail.volume24hUsd)}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-xs uppercase text-muted">Circulating</p>
              <p className="mt-1 text-white">{formatSupply(detail.circulatingSupply)}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-xs uppercase text-muted">Total Supply</p>
              <p className="mt-1 text-white">{formatSupply(detail.totalSupply)}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-xs uppercase text-muted">Max Supply</p>
              <p className="mt-1 text-white">{formatSupply(detail.maxSupply)}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-xs uppercase text-muted">Last Update</p>
              <p className="mt-1 text-white">
                {new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit" }).format(new Date(detail.updatedAt))}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <Card className="p-5">
          <h2 className="text-lg font-semibold text-white">About {detail.name}</h2>
          <p className="mt-3 text-sm leading-7 text-muted">
            {detail.description || `${detail.name} description is currently unavailable from the provider.`}
          </p>
          {detail.categories.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {detail.categories.slice(0, 10).map((category) => (
                <span key={category} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-muted">
                  {category}
                </span>
              ))}
            </div>
          ) : null}
        </Card>

        <Card className="p-5">
          <h2 className="text-lg font-semibold text-white">Related / trending</h2>
          <div className="mt-4 space-y-2">
            {detail.related.slice(0, 6).map((coin) => (
              <Link key={coin.id} href={`/markets/${coin.symbol.toLowerCase()}`} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm">
                <div className="flex items-center gap-2">
                  <CryptoIcon symbol={coin.symbol} src={coin.image} size={18} alt={`${coin.name} logo`} />
                  <span className="text-white">{coin.name}</span>
                </div>
                <span className="text-xs text-muted">{coin.symbol}</span>
              </Link>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="text-lg font-semibold text-white">Trading pairs and markets</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-muted">
              <tr>
                <th className="px-3 py-2">Market</th>
                <th className="px-3 py-2">Pair</th>
                <th className="px-3 py-2 text-right">Last price</th>
                <th className="px-3 py-2 text-right">Volume</th>
                <th className="px-3 py-2 text-right">Trust</th>
              </tr>
            </thead>
            <tbody>
              {detail.pairs.slice(0, 20).map((pair, index) => (
                <tr key={`${pair.market}-${pair.base}-${pair.target}-${index}`} className="border-t border-white/10">
                  <td className="px-3 py-2 text-white">{pair.market}</td>
                  <td className="px-3 py-2 text-muted">
                    {pair.base}/{pair.target}
                  </td>
                  <td className="px-3 py-2 text-right text-white">{pair.last ? pair.last.toLocaleString("en-US") : "N/A"}</td>
                  <td className="px-3 py-2 text-right text-muted">{pair.volume ? pair.volume.toLocaleString("en-US") : "N/A"}</td>
                  <td className="px-3 py-2 text-right text-muted">{pair.trustScore ?? "N/A"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {error ? <Card className="border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</Card> : null}
    </div>
  );
}

