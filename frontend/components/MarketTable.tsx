"use client";

import { Star } from "lucide-react";
import { useMemo, useState } from "react";
import { useDemo } from "@/lib/demo-provider";
import { formatCompact, formatNumber, percentClass } from "@/lib/utils";

const filters = ["All", "USDT", "BTC", "ETH", "Favorites"] as const;

export function MarketTable() {
  const { markets, favorites, toggleFavorite } = useDemo();
  const [activeFilter, setActiveFilter] = useState<(typeof filters)[number]>("All");
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    return markets.filter((row) => {
      const matchesFilter =
        activeFilter === "All" ||
        (activeFilter === "Favorites" ? favorites.includes(row.symbol) : row.quote === activeFilter);
      const matchesQuery = row.pair.toLowerCase().includes(query.toLowerCase()) || row.symbol.toLowerCase().includes(query.toLowerCase());
      return matchesFilter && matchesQuery;
    });
  }, [activeFilter, favorites, markets, query]);

  return (
    <div className="rounded-3xl border border-white/10 bg-card/90 shadow-panel">
      <div className="flex flex-col gap-4 border-b border-white/10 p-5 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2">
          {filters.map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`rounded-full px-4 py-2 text-sm ${activeFilter === filter ? "bg-accent text-slate-950" : "bg-white/5 text-muted"}`}
            >
              {filter}
            </button>
          ))}
        </div>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search assets or pairs"
          className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-muted md:w-72"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-muted">
            <tr>
              <th className="px-5 py-4">Pair</th>
              <th className="px-5 py-4">Last price</th>
              <th className="px-5 py-4">24h change</th>
              <th className="px-5 py-4">24h high</th>
              <th className="px-5 py-4">24h low</th>
              <th className="px-5 py-4">24h volume</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.symbol} className="border-t border-white/5 text-white">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <button onClick={() => toggleFavorite(row.symbol)} className={favorites.includes(row.symbol) ? "text-gold" : "text-muted"}>
                      <Star className="h-4 w-4" fill={favorites.includes(row.symbol) ? "currentColor" : "none"} />
                    </button>
                    <div>
                      <p className="font-medium">{row.pair}</p>
                      <p className="text-xs text-muted">{row.symbol}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4">{formatNumber(row.lastPrice, row.lastPrice > 1 ? 2 : 4)}</td>
                <td className={`px-5 py-4 ${percentClass(row.change24h)}`}>{row.change24h > 0 ? "+" : ""}{row.change24h}%</td>
                <td className="px-5 py-4">{formatNumber(row.high24h, row.high24h > 1 ? 2 : 4)}</td>
                <td className="px-5 py-4">{formatNumber(row.low24h, row.low24h > 1 ? 2 : 4)}</td>
                <td className="px-5 py-4">{formatCompact(row.volume24h)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

