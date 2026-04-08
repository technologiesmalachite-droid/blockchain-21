"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { CoinRow } from "@/components/markets/CoinRow";
import { NormalizedCoinMarket, QuoteAsset, SortDirection, SortField } from "@/lib/markets/types";
import { cn } from "@/lib/utils";

type CoinTableProps = {
  rows: NormalizedCoinMarket[];
  loading: boolean;
  quote: QuoteAsset;
  quoteRate: number;
  sortField: SortField;
  sortDirection: SortDirection;
  onSortChange: (field: SortField) => void;
  favorites: Set<string>;
  onToggleFavorite: (symbol: string) => void;
  emptyMessage: string;
};

const sortableHeaders: Array<{ field: SortField; label: string; alignRight?: boolean }> = [
  { field: "rank", label: "Rank" },
  { field: "name", label: "Coin" },
  { field: "price", label: "Last price", alignRight: true },
  { field: "change24h", label: "24h %", alignRight: true },
  { field: "volume", label: "24h volume", alignRight: true },
  { field: "marketCap", label: "Market cap", alignRight: true },
];

function SortIcon({ active, direction }: { active: boolean; direction: SortDirection }) {
  if (!active) return <ArrowUpDown className="h-3.5 w-3.5 text-muted" />;
  return direction === "asc" ? <ArrowUp className="h-3.5 w-3.5 text-accent" /> : <ArrowDown className="h-3.5 w-3.5 text-accent" />;
}

function SkeletonRow() {
  return (
    <tr className="border-b border-white/5">
      {Array.from({ length: 12 }).map((_, index) => (
        <td key={index} className="px-4 py-3">
          <div className="h-5 animate-pulse rounded bg-white/10" />
        </td>
      ))}
    </tr>
  );
}

export function CoinTable({
  rows,
  loading,
  quote,
  quoteRate,
  sortField,
  sortDirection,
  onSortChange,
  favorites,
  onToggleFavorite,
  emptyMessage,
}: CoinTableProps) {
  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-card/90 shadow-panel">
      <div className="overflow-x-auto">
        <table className="min-w-[1350px] w-full">
          <thead className="sticky top-0 z-10 border-b border-white/10 bg-slate-950/95 text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 text-left">
                <button type="button" className="inline-flex items-center gap-2" onClick={() => onSortChange("rank")}>
                  Rank
                  <SortIcon active={sortField === "rank"} direction={sortDirection} />
                </button>
              </th>
              <th className="px-4 py-3 text-left">Fav</th>
              <th className="px-4 py-3 text-left">
                <button type="button" className="inline-flex items-center gap-2" onClick={() => onSortChange("name")}>
                  Coin
                  <SortIcon active={sortField === "name"} direction={sortDirection} />
                </button>
              </th>
              <th className="px-4 py-3 text-left">Symbol</th>
              {sortableHeaders
                .filter((header) => !["rank", "name"].includes(header.field))
                .map((header) => (
                <th key={header.field} className={cn("px-4 py-3 text-left", header.alignRight && "text-right")}>
                  <button
                    type="button"
                    className={cn("inline-flex items-center gap-2", header.alignRight && "ml-auto")}
                    onClick={() => onSortChange(header.field)}
                  >
                    {header.label}
                    <SortIcon active={sortField === header.field} direction={sortDirection} />
                  </button>
                </th>
              ))}
              <th className="px-4 py-3 text-right">24h high</th>
              <th className="px-4 py-3 text-right">24h low</th>
              <th className="px-4 py-3 text-right">Circulating supply</th>
              <th className="px-4 py-3 text-left">7D</th>
            </tr>
          </thead>
          <tbody>
            {loading ? Array.from({ length: 12 }).map((_, index) => <SkeletonRow key={index} />) : null}
            {!loading && rows.length > 0
              ? rows.map((coin) => (
                  <CoinRow
                    key={coin.id}
                    coin={coin}
                    quote={quote}
                    quoteRate={quoteRate}
                    favorite={favorites.has(coin.symbol.toUpperCase())}
                    onToggleFavorite={onToggleFavorite}
                  />
                ))
              : null}
          </tbody>
        </table>
      </div>
      {!loading && rows.length === 0 ? (
        <div className="p-10 text-center text-sm text-muted">{emptyMessage}</div>
      ) : null}
    </div>
  );
}
