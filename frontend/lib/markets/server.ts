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

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";
const BINANCE_BASE = "https://api.binance.com/api/v3";
const MARKETS_TTL_MS = 45000;
const OVERVIEW_TTL_MS = 60000;
const DETAIL_TTL_MS = 90000;

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

let marketsCache: CacheEntry<MarketsSnapshot> | null = null;
let overviewCache: CacheEntry<MarketsOverview> | null = null;
const detailCache = new Map<string, CacheEntry<CoinDetailResponse>>();
let binanceExchangeInfoCache:
  | CacheEntry<Array<{ symbol: string; status: string; baseAsset: string; quoteAsset: string }>>
  | null = null;

type RawCoinMarket = {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number | null;
  market_cap_rank: number | null;
  high_24h: number | null;
  low_24h: number | null;
  total_volume: number | null;
  market_cap: number | null;
  circulating_supply: number | null;
  total_supply: number | null;
  price_change_percentage_24h: number | null;
  sparkline_in_7d?: {
    price?: number[];
  };
  last_updated: string;
};

type RawCoinMeta = {
  id: string;
  symbol: string;
  name: string;
  image?: { large?: string };
  description?: { en?: string };
  links?: { homepage?: string[] };
  categories?: string[];
};

type RawTrending = {
  coins?: Array<{
    item?: {
      id?: string;
      name?: string;
      symbol?: string;
      market_cap_rank?: number;
      small?: string;
    };
  }>;
};

type RawGlobal = {
  data?: {
    total_market_cap?: { usd?: number };
    total_volume?: { usd?: number };
    market_cap_percentage?: { btc?: number };
    market_cap_change_percentage_24h_usd?: number;
    active_cryptocurrencies?: number;
  };
};

type RawBinanceTicker = {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  highPrice: string;
  lowPrice: string;
  quoteVolume: string;
};

type RawBinanceExchangeInfo = {
  symbols?: Array<{
    symbol: string;
    status: string;
    baseAsset: string;
    quoteAsset: string;
  }>;
};

const now = () => Date.now();

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Provider request failed: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
}

function normalizeCoinMarket(raw: RawCoinMarket): NormalizedCoinMarket {
  return {
    id: raw.id,
    rank: raw.market_cap_rank ?? 999999,
    name: raw.name,
    symbol: raw.symbol.toUpperCase(),
    image: raw.image,
    currentPriceUsd: raw.current_price ?? 0,
    change24h: raw.price_change_percentage_24h ?? 0,
    high24hUsd: raw.high_24h ?? 0,
    low24hUsd: raw.low_24h ?? 0,
    volume24hUsd: raw.total_volume ?? 0,
    marketCapUsd: raw.market_cap ?? 0,
    circulatingSupply: raw.circulating_supply ?? null,
    totalSupply: raw.total_supply ?? null,
    sparkline7d: raw.sparkline_in_7d?.price?.filter((value) => Number.isFinite(value)) ?? [],
    lastUpdated: raw.last_updated,
  };
}

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function getQuotesFromMarkets(items: NormalizedCoinMarket[]) {
  const btc = items.find((item) => item.symbol === "BTC")?.currentPriceUsd ?? 0;
  const eth = items.find((item) => item.symbol === "ETH")?.currentPriceUsd ?? 0;
  return {
    USD: 1,
    USDT: 1,
    BTC: btc > 0 ? btc : 1,
    ETH: eth > 0 ? eth : 1,
  } as MarketsSnapshot["quotes"];
}

function pseudoSparkline(currentPrice: number, change24h: number, symbol: string): number[] {
  if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
    return [];
  }

  const start = currentPrice / (1 + change24h / 100);
  const seed = symbol.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const points = 7;
  const values: number[] = [];

  for (let index = 0; index < points; index += 1) {
    const progress = index / (points - 1);
    const baseline = start + (currentPrice - start) * progress;
    const wave = Math.sin((seed + index * 13) * 0.17) * baseline * 0.006;
    values.push(Number((baseline + wave).toFixed(currentPrice >= 1 ? 2 : 6)));
  }

  return values;
}

async function fetchMarketsFromProvider(): Promise<MarketsSnapshot> {
  const query =
    "?vs_currency=usd&order=market_cap_desc&per_page=125&sparkline=false&price_change_percentage=24h";
  const [firstPage, secondPage] = await Promise.all([
    fetchJson<RawCoinMarket[]>(`${COINGECKO_BASE}/coins/markets${query}&page=1`),
    fetchJson<RawCoinMarket[]>(`${COINGECKO_BASE}/coins/markets${query}&page=2`),
  ]);

  const items = [...firstPage, ...secondPage]
    .map((raw) => normalizeCoinMarket(raw))
    .map((item) => ({
      ...item,
      sparkline7d: item.sparkline7d.length > 0 ? item.sparkline7d : pseudoSparkline(item.currentPriceUsd, item.change24h, item.symbol),
    }))
    .filter((item) => item.currentPriceUsd >= 0)
    .sort((a, b) => a.rank - b.rank);

  return {
    items,
    quotes: getQuotesFromMarkets(items),
    updatedAt: new Date().toISOString(),
  };
}

async function fetchBinanceExchangeInfo(): Promise<
  Array<{ symbol: string; status: string; baseAsset: string; quoteAsset: string }>
> {
  if (binanceExchangeInfoCache && binanceExchangeInfoCache.expiresAt > now()) {
    return binanceExchangeInfoCache.value;
  }

  const data = await fetchJson<RawBinanceExchangeInfo>(`${BINANCE_BASE}/exchangeInfo`);
  const value = (data.symbols ?? []).filter((item) => item.status === "TRADING");
  binanceExchangeInfoCache = {
    value,
    expiresAt: now() + 60 * 60 * 1000,
  };
  return value;
}

const symbolNameMap: Record<string, string> = {
  BTC: "Bitcoin",
  ETH: "Ethereum",
  SOL: "Solana",
  BNB: "BNB",
  XRP: "XRP",
  ADA: "Cardano",
  DOGE: "Dogecoin",
  AVAX: "Avalanche",
  DOT: "Polkadot",
  LINK: "Chainlink",
  LTC: "Litecoin",
  MATIC: "Polygon",
  TRX: "TRON",
  TON: "Toncoin",
  NEAR: "NEAR Protocol",
  BCH: "Bitcoin Cash",
  UNI: "Uniswap",
  ATOM: "Cosmos",
  ETC: "Ethereum Classic",
  XLM: "Stellar",
};

function symbolToName(symbol: string) {
  return symbolNameMap[symbol] ?? symbol;
}

async function fetchMarketsFromBinance(): Promise<MarketsSnapshot> {
  const [tickers, exchangeInfo] = await Promise.all([
    fetchJson<RawBinanceTicker[]>(`${BINANCE_BASE}/ticker/24hr`),
    fetchBinanceExchangeInfo(),
  ]);

  const tickerMap = new Map(tickers.map((item) => [item.symbol, item]));
  const btcUsdt = Number(tickerMap.get("BTCUSDT")?.lastPrice ?? "0");
  const ethUsdt = Number(tickerMap.get("ETHUSDT")?.lastPrice ?? "0");

  const majorQuotes = new Set(["USDT", "BTC", "ETH"]);
  const candidates = exchangeInfo
    .filter((item) => majorQuotes.has(item.quoteAsset))
    .map((item) => ({
      ...item,
      ticker: tickerMap.get(item.symbol),
    }))
    .filter((item) => Boolean(item.ticker))
    .sort((a, b) => Number(b.ticker?.quoteVolume ?? "0") - Number(a.ticker?.quoteVolume ?? "0"));

  const bestByBase = new Map<string, { symbol: string; status: string; baseAsset: string; quoteAsset: string; ticker: RawBinanceTicker }>();

  for (const row of candidates) {
    const existing = bestByBase.get(row.baseAsset);
    if (!existing) {
      bestByBase.set(row.baseAsset, row as { symbol: string; status: string; baseAsset: string; quoteAsset: string; ticker: RawBinanceTicker });
      continue;
    }

    const currentVolume = Number(row.ticker?.quoteVolume ?? "0");
    const existingVolume = Number(existing.ticker.quoteVolume ?? "0");
    if (currentVolume > existingVolume) {
      bestByBase.set(row.baseAsset, row as { symbol: string; status: string; baseAsset: string; quoteAsset: string; ticker: RawBinanceTicker });
    }
  }

  const rows = Array.from(bestByBase.values()).slice(0, 320);
  const items: NormalizedCoinMarket[] = rows.map((row, index) => {
    const last = Number(row.ticker.lastPrice);
    const change = Number(row.ticker.priceChangePercent);
    const high = Number(row.ticker.highPrice);
    const low = Number(row.ticker.lowPrice);
    const quoteVolume = Number(row.ticker.quoteVolume);

    const quoteToUsd =
      row.quoteAsset === "USDT"
        ? 1
        : row.quoteAsset === "BTC"
          ? btcUsdt || 1
          : row.quoteAsset === "ETH"
            ? ethUsdt || 1
            : 1;

    const currentPriceUsd = last * quoteToUsd;
    const highUsd = high * quoteToUsd;
    const lowUsd = low * quoteToUsd;
    const volumeUsd = quoteVolume * quoteToUsd;

    return {
      id: row.baseAsset.toLowerCase(),
      rank: index + 1,
      name: symbolToName(row.baseAsset),
      symbol: row.baseAsset,
      image: "",
      currentPriceUsd,
      change24h: change,
      high24hUsd: highUsd,
      low24hUsd: lowUsd,
      volume24hUsd: volumeUsd,
      marketCapUsd: 0,
      circulatingSupply: null,
      totalSupply: null,
      sparkline7d: pseudoSparkline(currentPriceUsd, change, row.baseAsset),
      lastUpdated: new Date().toISOString(),
    };
  });

  return {
    items,
    quotes: {
      USD: 1,
      USDT: 1,
      BTC: btcUsdt > 0 ? btcUsdt : 1,
      ETH: ethUsdt > 0 ? ethUsdt : 1,
    },
    updatedAt: new Date().toISOString(),
  };
}

async function fetchTrending(): Promise<TrendingCoin[]> {
  const data = await fetchJson<RawTrending>(`${COINGECKO_BASE}/search/trending`);
  return (data.coins ?? [])
    .map((entry) => entry.item)
    .filter((item): item is NonNullable<typeof item> => Boolean(item?.id && item?.symbol))
    .slice(0, 8)
    .map((item) => ({
      id: item.id as string,
      symbol: (item.symbol as string).toUpperCase(),
      name: item.name as string,
      image: item.small ?? "",
      rank: item.market_cap_rank ?? 999999,
    }));
}

async function fetchTrendingSafe(): Promise<TrendingCoin[]> {
  try {
    return await fetchTrending();
  } catch {
    return [];
  }
}

async function fetchNewListingsSafe(): Promise<NewListingCoin[]> {
  try {
    const data = await fetchJson<Array<{ id?: string; symbol?: string; name?: string }>>(
      `${COINGECKO_BASE}/coins/list/new`,
    );
    return data
      .filter((item) => Boolean(item.id && item.symbol && item.name))
      .slice(0, 12)
      .map((item) => ({
        id: item.id as string,
        symbol: (item.symbol as string).toUpperCase(),
        name: item.name as string,
      }));
  } catch {
    return [];
  }
}

async function fetchGlobalSafe(): Promise<RawGlobal["data"]> {
  try {
    const data = await fetchJson<RawGlobal>(`${COINGECKO_BASE}/global`);
    return data.data;
  } catch {
    return undefined;
  }
}

export async function getMarketsSnapshot(): Promise<MarketsSnapshot> {
  if (marketsCache && marketsCache.expiresAt > now()) {
    return marketsCache.value;
  }

  try {
    const value = await fetchMarketsFromProvider();
    marketsCache = { value, expiresAt: now() + MARKETS_TTL_MS };
    return value;
  } catch {
    try {
      const value = await fetchMarketsFromBinance();
      marketsCache = { value, expiresAt: now() + Math.min(MARKETS_TTL_MS, 30000) };
      return value;
    } catch {
      if (marketsCache) {
        return marketsCache.value;
      }
      const value = fallbackMarketsSnapshot();
      marketsCache = { value, expiresAt: now() + 15000 };
      return value;
    }
  }
}

export async function getMarketsOverview(): Promise<MarketsOverview> {
  if (overviewCache && overviewCache.expiresAt > now()) {
    return overviewCache.value;
  }

  try {
    const [snapshot, globalData, trending, newListings] = await Promise.all([
      getMarketsSnapshot(),
      fetchGlobalSafe(),
      fetchTrendingSafe(),
      fetchNewListingsSafe(),
    ]);

    const sortedByChange = [...snapshot.items].sort((a, b) => b.change24h - a.change24h);
    const sortedByVolume = [...snapshot.items].sort((a, b) => b.volume24hUsd - a.volume24hUsd);
    const inferredMarketCap = snapshot.items.reduce((sum, item) => sum + item.marketCapUsd, 0);
    const inferredVolume = snapshot.items.reduce((sum, item) => sum + item.volume24hUsd, 0);

    const value: MarketsOverview = {
      totalMarketCapUsd: globalData?.total_market_cap?.usd ?? inferredMarketCap,
      totalVolumeUsd: globalData?.total_volume?.usd ?? inferredVolume,
      btcDominance: globalData?.market_cap_percentage?.btc ?? 0,
      marketCapChange24h: globalData?.market_cap_change_percentage_24h_usd ?? 0,
      activeCryptocurrencies: globalData?.active_cryptocurrencies ?? snapshot.items.length,
      hotCoins: sortedByVolume.slice(0, 6),
      topGainers: sortedByChange.slice(0, 6),
      topLosers: sortedByChange.slice(-6).reverse(),
      topVolume: sortedByVolume.slice(0, 6),
      trending,
      newListings,
      updatedAt: new Date().toISOString(),
    };

    overviewCache = { value, expiresAt: now() + OVERVIEW_TTL_MS };
    return value;
  } catch {
    if (overviewCache) {
      return overviewCache.value;
    }
    const value = fallbackOverview();
    overviewCache = { value, expiresAt: now() + 15000 };
    return value;
  }
}

async function resolveCoinId(symbolOrId: string): Promise<string | null> {
  const normalized = symbolOrId.toLowerCase();
  const snapshot = await getMarketsSnapshot();

  const byId = snapshot.items.find((item) => item.id === normalized);
  if (byId) return byId.id;

  const symbolMatches = snapshot.items
    .filter((item) => item.symbol.toLowerCase() === normalized)
    .sort((a, b) => a.rank - b.rank);
  if (symbolMatches.length > 0) return symbolMatches[0].id;

  try {
    const search = await fetchJson<{ coins?: Array<{ id?: string; symbol?: string }> }>(
      `${COINGECKO_BASE}/search?query=${encodeURIComponent(symbolOrId)}`,
    );
    const exact = (search.coins ?? []).find(
      (item) => item.symbol?.toLowerCase() === normalized || item.id?.toLowerCase() === normalized,
    );
    return exact?.id ?? null;
  } catch {
    return null;
  }
}

function buildSyntheticPairs(coin: NormalizedCoinMarket, snapshot: MarketsSnapshot): CoinDetailMarketPair[] {
  const pairs: Array<{ target: "USDT" | "BTC" | "ETH" | "USD"; quoteRate: number }> = [
    { target: "USDT", quoteRate: snapshot.quotes.USDT },
    { target: "BTC", quoteRate: snapshot.quotes.BTC },
    { target: "ETH", quoteRate: snapshot.quotes.ETH },
    { target: "USD", quoteRate: snapshot.quotes.USD },
  ];

  return pairs
    .filter((pair) => pair.target !== coin.symbol)
    .map((pair) => ({
      market: `${BRAND_NAME} Spot`,
      base: coin.symbol,
      target: pair.target,
      last: pair.quoteRate > 0 ? coin.currentPriceUsd / pair.quoteRate : coin.currentPriceUsd,
      volume: pair.quoteRate > 0 ? coin.volume24hUsd / pair.quoteRate : coin.volume24hUsd,
      trustScore: "green",
    }));
}

export async function getCoinDetailBySymbol(symbolOrId: string): Promise<CoinDetailResponse | null> {
  const key = symbolOrId.toLowerCase();
  const cached = detailCache.get(key);
  if (cached && cached.expiresAt > now()) {
    return cached.value;
  }

  try {
    const coinId = await resolveCoinId(symbolOrId);
    if (!coinId) return null;

    const snapshot = await getMarketsSnapshot();
    const snapshotRow = snapshot.items.find((item) => item.id === coinId) ?? null;

    const [rawMeta, marketRows, trending] = await Promise.all([
      fetchJson<RawCoinMeta>(
        `${COINGECKO_BASE}/coins/${coinId}?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false&sparkline=false`,
      ).catch(() => null),
      fetchJson<RawCoinMarket[]>(
        `${COINGECKO_BASE}/coins/markets?vs_currency=usd&ids=${encodeURIComponent(coinId)}&sparkline=true&price_change_percentage=24h`,
      ).catch(() => []),
      fetchTrendingSafe(),
    ]);

    const marketRow = marketRows.length > 0 ? normalizeCoinMarket(marketRows[0]) : snapshotRow;
    if (!marketRow) return null;

    const detail: CoinDetailResponse = {
      id: marketRow.id,
      symbol: marketRow.symbol.toUpperCase(),
      name: marketRow.name,
      image: rawMeta?.image?.large ?? marketRow.image,
      description: stripHtml(rawMeta?.description?.en ?? ""),
      currentPriceUsd: marketRow.currentPriceUsd,
      marketCapUsd: marketRow.marketCapUsd,
      volume24hUsd: marketRow.volume24hUsd,
      high24hUsd: marketRow.high24hUsd,
      low24hUsd: marketRow.low24hUsd,
      change24h: marketRow.change24h,
      circulatingSupply: marketRow.circulatingSupply,
      totalSupply: marketRow.totalSupply,
      maxSupply: null,
      sparkline7d: marketRow.sparkline7d,
      homepage: rawMeta?.links?.homepage?.[0] ?? "",
      categories: rawMeta?.categories ?? [],
      related: trending.filter((item) => item.id !== marketRow.id).slice(0, 6),
      pairs: buildSyntheticPairs(marketRow, snapshot),
      updatedAt: marketRow.lastUpdated ?? new Date().toISOString(),
    };

    detailCache.set(key, { value: detail, expiresAt: now() + DETAIL_TTL_MS });
    return detail;
  } catch {
    const fallback = fallbackCoinDetail(symbolOrId);
    detailCache.set(key, { value: fallback, expiresAt: now() + 15000 });
    return fallback;
  }
}
