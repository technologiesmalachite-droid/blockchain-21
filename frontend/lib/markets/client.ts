"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CoinDetailResponse, MarketsOverview, MarketsSnapshot } from "@/lib/markets/types";

const WATCHLIST_STORAGE_KEY = "malachitex.watchlist.v1";

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`);
  }
  return (await response.json()) as T;
}

export const fetchMarketsSnapshot = (signal?: AbortSignal) => fetchJson<MarketsSnapshot>("/api/markets", signal);

export const fetchMarketsOverview = (signal?: AbortSignal) =>
  fetchJson<MarketsOverview>("/api/markets/overview", signal);

export const fetchCoinDetail = (symbol: string, signal?: AbortSignal) =>
  fetchJson<CoinDetailResponse>(`/api/markets/${encodeURIComponent(symbol)}`, signal);

export function useWatchlist() {
  const [symbols, setSymbols] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(WATCHLIST_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as string[];
        setSymbols(parsed.map((item) => item.toUpperCase()));
      }
    } catch {
      setSymbols([]);
    } finally {
      setHydrated(true);
    }
  }, []);

  const save = useCallback((next: string[]) => {
    setSymbols(next);
    window.localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(next));
  }, []);

  const toggle = useCallback(
    (symbol: string) => {
      const normalized = symbol.toUpperCase();
      const has = symbols.includes(normalized);
      const next = has ? symbols.filter((item) => item !== normalized) : [...symbols, normalized];
      save(next);
      return !has;
    },
    [save, symbols],
  );

  const lookup = useMemo(() => new Set(symbols), [symbols]);

  return {
    hydrated,
    symbols,
    lookup,
    toggle,
    isFavorite: (symbol: string) => lookup.has(symbol.toUpperCase()),
  };
}

