export type QuoteAsset = "ALL" | "USDT" | "BTC" | "ETH" | "BNB" | "FDUSD" | "TRY" | "EUR" | "BRL";

export type MarketType = "spot" | "futures";

export type MarketTab =
  | "overview"
  | "spot"
  | "futures"
  | "favorites"
  | "gainers"
  | "losers"
  | "volume"
  | "new";

export type SortField = "rank" | "name" | "price" | "change24h" | "volume" | "marketCap";

export type SortDirection = "asc" | "desc";

export interface NormalizedCoinMarket {
  id: string;
  rank: number;
  name: string;
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  status: string;
  pricePrecision: number;
  quantityPrecision: number;
  tickSize: string | null;
  stepSize: string | null;
  minNotional: string | null;
  lastPrice: number;
  priceChangePercent: number;
  highPrice: number;
  lowPrice: number;
  volume: number;
  baseVolume: number;
  image: string;
  // Compatibility aliases used by existing UI components.
  currentPriceUsd: number;
  change24h: number;
  high24hUsd: number;
  low24hUsd: number;
  volume24hUsd: number;
  marketCapUsd: number;
  circulatingSupply: number | null;
  totalSupply: number | null;
  sparkline7d: number[];
  lastUpdated: string;
}

export interface TrendingCoin {
  id: string;
  symbol: string;
  name: string;
  rank: number;
  image: string;
}

export interface NewListingCoin {
  id: string;
  symbol: string;
  name: string;
}

export interface MarketsOverview {
  totalMarketCapUsd: number;
  totalVolumeUsd: number;
  btcDominance: number;
  marketCapChange24h: number;
  activeCryptocurrencies: number;
  hotCoins: NormalizedCoinMarket[];
  topGainers: NormalizedCoinMarket[];
  topLosers: NormalizedCoinMarket[];
  topVolume: NormalizedCoinMarket[];
  trending: TrendingCoin[];
  newListings: NewListingCoin[];
  updatedAt: string;
}

export interface CoinDetailMarketPair {
  market: string;
  base: string;
  target: string;
  last: number | null;
  volume: number | null;
  trustScore: string | null;
}

export interface CoinDetailResponse {
  id: string;
  symbol: string;
  name: string;
  image: string;
  description: string;
  currentPriceUsd: number;
  marketCapUsd: number;
  volume24hUsd: number;
  high24hUsd: number;
  low24hUsd: number;
  change24h: number;
  circulatingSupply: number | null;
  totalSupply: number | null;
  maxSupply: number | null;
  sparkline7d: number[];
  homepage: string;
  categories: string[];
  related: TrendingCoin[];
  pairs: CoinDetailMarketPair[];
  updatedAt: string;
}

export interface MarketsSnapshot {
  items: NormalizedCoinMarket[];
  quotes: Record<string, number>;
  source?: string;
  stale?: boolean;
  staleReason?: string | null;
  updatedAt: string;
}
