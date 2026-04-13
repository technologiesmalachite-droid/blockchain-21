"use client";

import { Search } from "lucide-react";
import { MarketType, QuoteAsset, SortDirection, SortField } from "@/lib/markets/types";

type MoverFilter = "all" | "gainers" | "losers";

type CoinSearchBarProps = {
  search: string;
  onSearchChange: (value: string) => void;
  marketType: MarketType;
  onMarketTypeChange: (value: MarketType) => void;
  quote: QuoteAsset;
  onQuoteChange: (value: QuoteAsset) => void;
  moverFilter: MoverFilter;
  onMoverFilterChange: (value: MoverFilter) => void;
  watchlistOnly: boolean;
  onWatchlistOnlyChange: (value: boolean) => void;
  sortField: SortField;
  sortDirection: SortDirection;
  onSortFieldChange: (value: SortField) => void;
  onSortDirectionChange: (value: SortDirection) => void;
};

export function CoinSearchBar({
  search,
  onSearchChange,
  marketType,
  onMarketTypeChange,
  quote,
  onQuoteChange,
  moverFilter,
  onMoverFilterChange,
  watchlistOnly,
  onWatchlistOnlyChange,
  sortField,
  sortDirection,
  onSortFieldChange,
  onSortDirectionChange,
}: CoinSearchBarProps) {
  return (
    <div className="rounded-3xl border border-white/10 bg-card/90 p-4 shadow-panel">
      <div className="flex flex-col gap-3 lg:flex-row">
        <label className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search by symbol, base asset, or pair"
            className="w-full rounded-2xl border border-white/10 bg-black/20 py-2.5 pl-9 pr-3 text-sm text-white outline-none placeholder:text-muted"
          />
        </label>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
          <select
            value={marketType}
            onChange={(event) => onMarketTypeChange(event.target.value as MarketType)}
            className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white"
          >
            <option value="spot">Spot</option>
            <option value="futures">Futures</option>
          </select>

          <select
            value={quote}
            onChange={(event) => onQuoteChange(event.target.value as QuoteAsset)}
            className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white"
          >
            <option value="ALL">All quotes</option>
            <option value="USDT">USDT</option>
            <option value="BTC">BTC</option>
            <option value="ETH">ETH</option>
            <option value="BNB">BNB</option>
            <option value="FDUSD">FDUSD</option>
            <option value="TRY">TRY</option>
            <option value="EUR">EUR</option>
            <option value="BRL">BRL</option>
          </select>

          <select
            value={moverFilter}
            onChange={(event) => onMoverFilterChange(event.target.value as MoverFilter)}
            className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white"
          >
            <option value="all">All movers</option>
            <option value="gainers">Gainers</option>
            <option value="losers">Losers</option>
          </select>

          <select
            value={sortField}
            onChange={(event) => onSortFieldChange(event.target.value as SortField)}
            className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white"
          >
            <option value="rank">Sort: rank</option>
            <option value="name">Sort: alphabetic</option>
            <option value="price">Sort: price</option>
            <option value="change24h">Sort: 24h change</option>
            <option value="volume">Sort: volume</option>
            <option value="marketCap">Sort: market cap</option>
          </select>

          <select
            value={sortDirection}
            onChange={(event) => onSortDirectionChange(event.target.value as SortDirection)}
            className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white"
          >
            <option value="desc">Desc</option>
            <option value="asc">Asc</option>
          </select>

          <button
            type="button"
            onClick={() => onWatchlistOnlyChange(!watchlistOnly)}
            className={`rounded-2xl border px-3 py-2.5 text-sm ${watchlistOnly ? "border-gold/40 bg-gold/10 text-gold" : "border-white/10 bg-black/20 text-muted"}`}
          >
            Watchlist
          </button>
        </div>
      </div>
    </div>
  );
}

export type { MoverFilter };

