"use client";

import { startTransition, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { CoinSearchBar, type MoverFilter } from "@/components/markets/CoinSearchBar";
import { CoinTable } from "@/components/markets/CoinTable";
import { MarketSummaryCards } from "@/components/markets/MarketSummaryCards";
import { MarketsHeader } from "@/components/markets/MarketsHeader";
import { MarketsTabs } from "@/components/markets/MarketsTabs";
import { Card } from "@/components/ui/Card";
import { fetchMarketsOverview, fetchMarketsSnapshot, useWatchlist } from "@/lib/markets/client";
import {
  MarketTab,
  MarketsOverview,
  MarketsSnapshot,
  MarketType,
  NormalizedCoinMarket,
  QuoteAsset,
  SortDirection,
  SortField,
} from "@/lib/markets/types";
import { formatSignedPercent, percentTextColor } from "@/lib/markets/format";

const REFRESH_INTERVAL_MS = 45000;
const DEFAULT_PAGE_SIZE = 50;

type MarketsClientPageProps = {
  initialSnapshot: MarketsSnapshot;
  initialOverview: MarketsOverview;
};

function sortRows(rows: NormalizedCoinMarket[], field: SortField, direction: SortDirection) {
  const sorted = [...rows];
  sorted.sort((a, b) => {
    const base =
      field === "rank"
        ? a.rank - b.rank
        : field === "name"
          ? a.name.localeCompare(b.name)
          : field === "price"
            ? a.currentPriceUsd - b.currentPriceUsd
            : field === "change24h"
              ? a.change24h - b.change24h
              : field === "volume"
                ? a.volume24hUsd - b.volume24hUsd
                : a.marketCapUsd - b.marketCapUsd;
    return direction === "asc" ? base : -base;
  });
  return sorted;
}

export function MarketsClientPage({ initialSnapshot, initialOverview }: MarketsClientPageProps) {
  const [snapshot, setSnapshot] = useState<MarketsSnapshot>(initialSnapshot);
  const [overview, setOverview] = useState<MarketsOverview>(initialOverview);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<MarketTab>("overview");
  const [marketType, setMarketType] = useState<MarketType>("spot");
  const [quote, setQuote] = useState<QuoteAsset>("USDT");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [moverFilter, setMoverFilter] = useState<MoverFilter>("all");
  const [watchlistOnly, setWatchlistOnly] = useState(false);
  const [sortField, setSortField] = useState<SortField>("rank");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [page, setPage] = useState(1);

  const { hydrated, symbols, lookup, toggle } = useWatchlist();

  const fetchAll = useCallback(async (isBackground: boolean) => {
    try {
      if (isBackground) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      const [nextSnapshot, nextOverview] = await Promise.all([fetchMarketsSnapshot(), fetchMarketsOverview()]);
      startTransition(() => {
        setSnapshot(nextSnapshot);
        setOverview(nextOverview);
      });
      setError(null);
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "Market feed unavailable.";
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(searchInput.trim().toLowerCase()), 250);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      fetchAll(true);
    }, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [fetchAll]);

  const applyTabPreset = useCallback(
    (tab: MarketTab) => {
      setActiveTab(tab);
      setPage(1);
      if (tab === "futures") {
        setMarketType("futures");
        return;
      }
      setMarketType("spot");
      if (tab === "favorites") {
        setWatchlistOnly(true);
      } else {
        setWatchlistOnly(false);
      }
      if (tab === "gainers") {
        setMoverFilter("gainers");
        setSortField("change24h");
        setSortDirection("desc");
        return;
      }
      if (tab === "losers") {
        setMoverFilter("losers");
        setSortField("change24h");
        setSortDirection("asc");
        return;
      }
      if (tab === "volume") {
        setMoverFilter("all");
        setSortField("volume");
        setSortDirection("desc");
        return;
      }
      if (tab === "new") {
        setMoverFilter("all");
        setSortField("rank");
        setSortDirection("asc");
        return;
      }
      if (tab === "spot" || tab === "overview") {
        setMoverFilter("all");
      }
    },
    [],
  );

  const filteredRows = useMemo(() => {
    let rows = snapshot.items;

    if (activeTab === "new" && overview.newListings.length > 0) {
      const listingIds = new Set(overview.newListings.map((item) => item.id));
      rows = rows.filter((row) => listingIds.has(row.id));
    }

    if (watchlistOnly) {
      rows = rows.filter((row) => lookup.has(row.symbol.toUpperCase()));
    }

    if (moverFilter === "gainers") {
      rows = rows.filter((row) => row.change24h >= 0);
    } else if (moverFilter === "losers") {
      rows = rows.filter((row) => row.change24h < 0);
    }

    if (debouncedSearch) {
      rows = rows.filter((row) => {
        const pair = `${row.symbol.toLowerCase()}/${quote.toLowerCase()}`;
        return (
          row.name.toLowerCase().includes(debouncedSearch) ||
          row.symbol.toLowerCase().includes(debouncedSearch) ||
          pair.includes(debouncedSearch)
        );
      });
    }

    return sortRows(rows, sortField, sortDirection);
  }, [activeTab, debouncedSearch, lookup, moverFilter, overview.newListings, quote, snapshot.items, sortDirection, sortField, watchlistOnly]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safePage = Math.min(page, totalPages);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  useEffect(() => {
    fetchAll(true);
  }, [fetchAll]);

  const pagedRows = useMemo(() => {
    const from = (safePage - 1) * pageSize;
    return filteredRows.slice(from, from + pageSize);
  }, [filteredRows, pageSize, safePage]);

  const quoteRate = snapshot.quotes[quote] || 1;

  const tableEmptyMessage =
    watchlistOnly && hydrated && symbols.length === 0
      ? "Your watchlist is empty. Star coins in the table to track favorites."
      : "No market rows match current filters.";

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-12 lg:px-8">
      <MarketsHeader updatedAt={snapshot.updatedAt} refreshing={refreshing} />
      <MarketSummaryCards overview={overview} loading={loading} />
      <MarketsTabs activeTab={activeTab} onChange={applyTabPreset} favoritesCount={symbols.length} />

      <Card className="p-4">
        <div className="grid gap-4 lg:grid-cols-3">
          <div>
            <p className="text-sm text-muted">Top gainers</p>
            <div className="mt-3 space-y-2">
              {overview.topGainers.slice(0, 3).map((coin) => (
                <Link key={coin.id} href={`/markets/${coin.symbol.toLowerCase()}`} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm">
                  <span className="text-white">{coin.symbol}</span>
                  <span className={percentTextColor(coin.change24h)}>{formatSignedPercent(coin.change24h)}</span>
                </Link>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm text-muted">Top losers</p>
            <div className="mt-3 space-y-2">
              {overview.topLosers.slice(0, 3).map((coin) => (
                <Link key={coin.id} href={`/markets/${coin.symbol.toLowerCase()}`} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm">
                  <span className="text-white">{coin.symbol}</span>
                  <span className={percentTextColor(coin.change24h)}>{formatSignedPercent(coin.change24h)}</span>
                </Link>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm text-muted">Recently added</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {overview.newListings.slice(0, 8).map((coin) => (
                <span key={coin.id} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-muted">
                  {coin.symbol}
                </span>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <CoinSearchBar
        search={searchInput}
        onSearchChange={(value) => {
          setSearchInput(value);
          setPage(1);
        }}
        marketType={marketType}
        onMarketTypeChange={(value) => {
          setMarketType(value);
          setPage(1);
          if (value === "futures") setActiveTab("futures");
        }}
        quote={quote}
        onQuoteChange={(value) => setQuote(value)}
        moverFilter={moverFilter}
        onMoverFilterChange={(value) => {
          setMoverFilter(value);
          setPage(1);
        }}
        watchlistOnly={watchlistOnly}
        onWatchlistOnlyChange={(value) => {
          setWatchlistOnly(value);
          setPage(1);
          if (value) setActiveTab("favorites");
        }}
        sortField={sortField}
        sortDirection={sortDirection}
        onSortFieldChange={(value) => setSortField(value)}
        onSortDirectionChange={(value) => setSortDirection(value)}
      />

      {marketType === "futures" ? (
        <Card className="border-gold/20 bg-gold/10 p-4 text-sm text-gold">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Futures tab is UI-ready and currently backed by spot market data as a placeholder until a derivatives
              feed is connected.
            </p>
          </div>
        </Card>
      ) : null}

      {error ? (
        <Card className="border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
          Failed to refresh market feed: {error}
        </Card>
      ) : null}

      <CoinTable
        rows={pagedRows}
        loading={loading}
        quote={quote}
        quoteRate={quoteRate}
        sortField={sortField}
        sortDirection={sortDirection}
        onSortChange={(field) => {
          if (sortField === field) {
            setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
          } else {
            setSortField(field);
            setSortDirection(field === "rank" || field === "name" ? "asc" : "desc");
          }
        }}
        favorites={lookup}
        onToggleFavorite={(symbol) => {
          toggle(symbol);
        }}
        emptyMessage={tableEmptyMessage}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-card/80 px-4 py-3">
        <div className="text-sm text-muted">
          Showing {(safePage - 1) * pageSize + 1}-{Math.min(safePage * pageSize, filteredRows.length)} of{" "}
          {filteredRows.length} pairs
        </div>
        <div className="flex items-center gap-2">
          <select
            value={String(pageSize)}
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setPage(1);
            }}
            className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"
          >
            <option value="25">25 / page</option>
            <option value="50">50 / page</option>
            <option value="100">100 / page</option>
          </select>
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={safePage <= 1}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white disabled:opacity-40"
          >
            Prev
          </button>
          <span className="px-2 text-sm text-muted">
            Page {safePage} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            disabled={safePage >= totalPages}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
