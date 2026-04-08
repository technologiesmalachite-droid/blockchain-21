export type QuoteAsset = "USD" | "USDT" | "BTC" | "ETH";

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
  image: string;
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
  quotes: Record<QuoteAsset, number>;
  updatedAt: string;
}

