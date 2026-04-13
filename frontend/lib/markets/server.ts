import "server-only";
import {
  CoinDetailResponse,
  CoinDetailMarketPair,
  MarketsOverview,
  MarketsSnapshot,
  NewListingCoin,
  NormalizedCoinMarket,
  TrendingCoin,
} from "@/lib/markets/types";
import { BRAND_NAME } from "@/lib/brand";
import { fallbackCoinDetail, fallbackMarketsSnapshot, fallbackOverview } from "@/lib/markets/fallback";

const MARKETS_TTL_MS = 20_000;
const OVERVIEW_TTL_MS = 20_000;
const DETAIL_TTL_MS = 60_000;
const REQUEST_TIMEOUT_MS = 8_000;
const ICON_CDN_BASE =
  process.env.NEXT_PUBLIC_MARKET_ICON_BASE_URL ||
  "https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/128/color";

const ICON_ALIASES: Record<string, string> = {
  BCHABC: "bch",
  BCHSV: "bsv",
  MIOTA: "iota",
  BTTOLD: "btt",
  XBT: "btc",
};

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

type BackendBinanceMarket = {
  id?: string;
  symbol?: string;
  baseAsset?: string;
  quoteAsset?: string;
  status?: string;
  pricePrecision?: number;
  quantityPrecision?: number;
  filters?: {
    tickSize?: string | null;
    stepSize?: string | null;
    minNotional?: string | null;
  };
  lastPrice?: number | string;
  priceChangePercent?: number | string;
  highPrice?: number | string;
  lowPrice?: number | string;
  volume?: number | string;
  baseVolume?: number | string;
  image?: string;
  rank?: number;
  updatedAt?: string;
};

type BackendBinanceSnapshot = {
  source?: string;
  stale?: boolean;
  staleReason?: string | null;
  updatedAt?: string;
  items?: BackendBinanceMarket[];
};

let marketsCache: CacheEntry<MarketsSnapshot> | null = null;
let overviewCache: CacheEntry<MarketsOverview> | null = null;
const detailCache = new Map<string, CacheEntry<CoinDetailResponse>>();

const now = () => Date.now();
const asNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const backendApiBase =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
  "https://malachitex-backend-production.up.railway.app/api";

const normalizeIconCode = (symbol: string) => {
  const normalized = String(symbol || "").toUpperCase();
  const mapped = ICON_ALIASES[normalized] || normalized;
  const cleaned = mapped.toLowerCase().replace(/[^a-z0-9]/g, "");
  return cleaned || "generic";
};

const safeImage = (symbol: string, image?: string) => image || `${ICON_CDN_BASE}/${normalizeIconCode(symbol)}.png`;

const fetchWithTimeout = async <T>(url: string): Promise<T> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: { accept: "application/json" },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Market request failed (${response.status})`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
};

const pseudoSparkline = (price: number, changePercent: number, symbol: string): number[] => {
  if (!Number.isFinite(price) || price <= 0) {
    return [];
  }

  const points = 10;
  const seed = symbol.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const start = price / (1 + changePercent / 100 || 1);
  const output: number[] = [];

  for (let index = 0; index < points; index += 1) {
    const progress = index / (points - 1);
    const baseline = start + (price - start) * progress;
    const wave = Math.sin((seed + index * 17) * 0.13) * baseline * 0.004;
    output.push(Number((baseline + wave).toFixed(price >= 1 ? 4 : 8)));
  }

  return output;
};

const toNormalized = (item: BackendBinanceMarket, index: number): NormalizedCoinMarket => {
  const symbol = String(item.symbol || "").toUpperCase();
  const baseAsset = String(item.baseAsset || symbol).toUpperCase();
  const quoteAsset = String(item.quoteAsset || "USDT").toUpperCase();
  const lastPrice = asNumber(item.lastPrice);
  const change = asNumber(item.priceChangePercent);
  const high = asNumber(item.highPrice);
  const low = asNumber(item.lowPrice);
  const volume = asNumber(item.volume);
  const baseVolume = asNumber(item.baseVolume);
  const tickSize = item.filters?.tickSize ?? null;
  const stepSize = item.filters?.stepSize ?? null;
  const minNotional = item.filters?.minNotional ?? null;
  const rank = Number.isFinite(Number(item.rank)) && Number(item.rank) > 0 ? Number(item.rank) : index + 1;
  const name = baseAsset;

  return {
    id: item.id || symbol,
    rank,
    name,
    symbol,
    baseAsset,
    quoteAsset,
    status: item.status || "TRADING",
    pricePrecision: asNumber(item.pricePrecision, 8),
    quantityPrecision: asNumber(item.quantityPrecision, 8),
    tickSize,
    stepSize,
    minNotional,
    lastPrice,
    priceChangePercent: change,
    highPrice: high,
    lowPrice: low,
    volume,
    baseVolume,
    image: safeImage(baseAsset, item.image),
    currentPriceUsd: lastPrice,
    change24h: change,
    high24hUsd: high,
    low24hUsd: low,
    volume24hUsd: volume,
    marketCapUsd: 0,
    circulatingSupply: null,
    totalSupply: null,
    sparkline7d: pseudoSparkline(lastPrice, change, symbol),
    lastUpdated: item.updatedAt || new Date().toISOString(),
  };
};

const trendingFromSnapshot = (items: NormalizedCoinMarket[]): TrendingCoin[] =>
  items.slice(0, 12).map((item, index) => ({
    id: item.id,
    symbol: item.baseAsset,
    name: item.name,
    image: item.image,
    rank: index + 1,
  }));

const newListingsFromSnapshot = (items: NormalizedCoinMarket[]): NewListingCoin[] =>
  items.slice(0, 12).map((item) => ({
    id: item.id,
    symbol: item.symbol,
    name: `${item.baseAsset}/${item.quoteAsset}`,
  }));

export async function getMarketsSnapshot(): Promise<MarketsSnapshot> {
  if (marketsCache && marketsCache.expiresAt > now()) {
    return marketsCache.value;
  }

  try {
    const raw = await fetchWithTimeout<BackendBinanceSnapshot>(`${backendApiBase}/markets/binance`);
    const rows = (raw.items ?? []).map((item, index) => toNormalized(item, index));

    const snapshot: MarketsSnapshot = {
      items: rows,
      quotes: {
        ALL: 1,
        USDT: 1,
        BTC: 1,
        ETH: 1,
        BNB: 1,
        FDUSD: 1,
        TRY: 1,
        EUR: 1,
        BRL: 1,
      },
      source: raw.source || "binance",
      stale: Boolean(raw.stale),
      staleReason: raw.staleReason ?? null,
      updatedAt: raw.updatedAt || new Date().toISOString(),
    };

    marketsCache = { value: snapshot, expiresAt: now() + MARKETS_TTL_MS };
    return snapshot;
  } catch (error) {
    if (marketsCache) {
      return {
        ...marketsCache.value,
        stale: true,
        staleReason: "Live market feed unavailable. Showing the most recent cached market snapshot.",
      };
    }

    const fallback = fallbackMarketsSnapshot();
    return {
      ...fallback,
      stale: true,
      staleReason: "Market feed unavailable. Showing fallback market snapshot.",
    };
  }
}

export async function getMarketsOverview(): Promise<MarketsOverview> {
  if (overviewCache && overviewCache.expiresAt > now()) {
    return overviewCache.value;
  }

  try {
    const snapshot = await getMarketsSnapshot();
    const rows = snapshot.items;
    const byChange = [...rows].sort((a, b) => b.change24h - a.change24h);
    const byVolume = [...rows].sort((a, b) => b.volume24hUsd - a.volume24hUsd);

    const value: MarketsOverview = {
      totalMarketCapUsd: rows.reduce((sum, row) => sum + row.marketCapUsd, 0),
      totalVolumeUsd: rows.reduce((sum, row) => sum + row.volume24hUsd, 0),
      btcDominance: 0,
      marketCapChange24h: 0,
      activeCryptocurrencies: rows.length,
      hotCoins: byVolume.slice(0, 8),
      topGainers: byChange.slice(0, 8),
      topLosers: byChange.slice(-8).reverse(),
      topVolume: byVolume.slice(0, 8),
      trending: trendingFromSnapshot(byVolume),
      newListings: newListingsFromSnapshot(rows),
      updatedAt: snapshot.updatedAt,
    };

    overviewCache = { value, expiresAt: now() + OVERVIEW_TTL_MS };
    return value;
  } catch {
    if (overviewCache) {
      return overviewCache.value;
    }
    return fallbackOverview();
  }
}

const toPairs = (coin: NormalizedCoinMarket, snapshot: MarketsSnapshot): CoinDetailMarketPair[] => {
  const pairs = snapshot.items.filter((item) => item.baseAsset === coin.baseAsset).slice(0, 25);
  if (pairs.length === 0) {
    return [
      {
        market: `${BRAND_NAME} Spot`,
        base: coin.baseAsset,
        target: coin.quoteAsset,
        last: coin.lastPrice,
        volume: coin.volume,
        trustScore: "green",
      },
    ];
  }

  return pairs.map((pair) => ({
    market: `${BRAND_NAME} Spot`,
    base: pair.baseAsset,
    target: pair.quoteAsset,
    last: pair.lastPrice,
    volume: pair.volume,
    trustScore: "green",
  }));
};

export async function getCoinDetailBySymbol(symbolOrId: string): Promise<CoinDetailResponse | null> {
  const key = symbolOrId.toLowerCase();
  const cached = detailCache.get(key);
  if (cached && cached.expiresAt > now()) {
    return cached.value;
  }

  try {
    const snapshot = await getMarketsSnapshot();
    const normalized = symbolOrId.toLowerCase();
    const coin =
      snapshot.items.find((item) => item.symbol.toLowerCase() === normalized) ||
      snapshot.items.find((item) => item.baseAsset.toLowerCase() === normalized) ||
      snapshot.items.find((item) => item.id.toLowerCase() === normalized);

    if (!coin) {
      return null;
    }

    const related = snapshot.items
      .filter((item) => item.id !== coin.id && item.quoteAsset === coin.quoteAsset)
      .slice(0, 6)
      .map((item, index) => ({
        id: item.id,
        symbol: item.baseAsset,
        name: item.name,
        image: item.image,
        rank: index + 1,
      }));

    const detail: CoinDetailResponse = {
      id: coin.id,
      symbol: coin.baseAsset,
      name: coin.name,
      image: coin.image,
      description: `${coin.baseAsset}/${coin.quoteAsset} live spot market sourced from Binance exchange metadata and 24h ticker feed.`,
      currentPriceUsd: coin.lastPrice,
      marketCapUsd: coin.marketCapUsd,
      volume24hUsd: coin.volume,
      high24hUsd: coin.highPrice,
      low24hUsd: coin.lowPrice,
      change24h: coin.priceChangePercent,
      circulatingSupply: null,
      totalSupply: null,
      maxSupply: null,
      sparkline7d: coin.sparkline7d,
      homepage: "",
      categories: [`Quote: ${coin.quoteAsset}`, `Status: ${coin.status}`],
      related,
      pairs: toPairs(coin, snapshot),
      updatedAt: coin.lastUpdated,
    };

    detailCache.set(key, { value: detail, expiresAt: now() + DETAIL_TTL_MS });
    return detail;
  } catch {
    return fallbackCoinDetail(symbolOrId);
  }
}
