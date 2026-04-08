import { CoinDetailResponse, MarketsOverview, MarketsSnapshot, NormalizedCoinMarket } from "@/lib/markets/types";

const fallbackItems: NormalizedCoinMarket[] = [
  {
    id: "bitcoin",
    rank: 1,
    name: "Bitcoin",
    symbol: "BTC",
    image: "https://coin-images.coingecko.com/coins/images/1/large/bitcoin.png",
    currentPriceUsd: 68000,
    change24h: 1.2,
    high24hUsd: 69100,
    low24hUsd: 67020,
    volume24hUsd: 42000000000,
    marketCapUsd: 1350000000000,
    circulatingSupply: 20010000,
    totalSupply: 21000000,
    sparkline7d: [66500, 66900, 67200, 67700, 67600, 68100, 68000],
    lastUpdated: new Date().toISOString(),
  },
  {
    id: "ethereum",
    rank: 2,
    name: "Ethereum",
    symbol: "ETH",
    image: "https://coin-images.coingecko.com/coins/images/279/large/ethereum.png",
    currentPriceUsd: 3500,
    change24h: 0.8,
    high24hUsd: 3560,
    low24hUsd: 3440,
    volume24hUsd: 18000000000,
    marketCapUsd: 420000000000,
    circulatingSupply: 120700000,
    totalSupply: null,
    sparkline7d: [3380, 3420, 3440, 3470, 3490, 3520, 3500],
    lastUpdated: new Date().toISOString(),
  },
  {
    id: "tether",
    rank: 3,
    name: "Tether",
    symbol: "USDT",
    image: "https://coin-images.coingecko.com/coins/images/325/large/Tether.png",
    currentPriceUsd: 1,
    change24h: 0,
    high24hUsd: 1.001,
    low24hUsd: 0.999,
    volume24hUsd: 70000000000,
    marketCapUsd: 120000000000,
    circulatingSupply: 120000000000,
    totalSupply: null,
    sparkline7d: [1, 1, 1, 1, 1, 1, 1],
    lastUpdated: new Date().toISOString(),
  },
  {
    id: "bnb",
    rank: 4,
    name: "BNB",
    symbol: "BNB",
    image: "https://coin-images.coingecko.com/coins/images/825/large/bnb-icon2_2x.png",
    currentPriceUsd: 610,
    change24h: -0.6,
    high24hUsd: 624,
    low24hUsd: 604,
    volume24hUsd: 2100000000,
    marketCapUsd: 90000000000,
    circulatingSupply: 147600000,
    totalSupply: 200000000,
    sparkline7d: [592, 600, 606, 615, 620, 614, 610],
    lastUpdated: new Date().toISOString(),
  },
  {
    id: "solana",
    rank: 5,
    name: "Solana",
    symbol: "SOL",
    image: "https://coin-images.coingecko.com/coins/images/4128/large/solana.png",
    currentPriceUsd: 170,
    change24h: 3.1,
    high24hUsd: 173,
    low24hUsd: 162,
    volume24hUsd: 4200000000,
    marketCapUsd: 79000000000,
    circulatingSupply: 465000000,
    totalSupply: 587000000,
    sparkline7d: [156, 161, 164, 167, 169, 171, 170],
    lastUpdated: new Date().toISOString(),
  },
];

export const fallbackMarketsSnapshot = (): MarketsSnapshot => ({
  items: fallbackItems,
  quotes: {
    USD: 1,
    USDT: 1,
    BTC: fallbackItems[0].currentPriceUsd,
    ETH: fallbackItems[1].currentPriceUsd,
  },
  updatedAt: new Date().toISOString(),
});

export const fallbackOverview = (): MarketsOverview => {
  const updatedAt = new Date().toISOString();
  return {
    totalMarketCapUsd: 2700000000000,
    totalVolumeUsd: 130000000000,
    btcDominance: 52.3,
    marketCapChange24h: 1.8,
    activeCryptocurrencies: 12900,
    hotCoins: fallbackItems.slice(0, 4),
    topGainers: [...fallbackItems].sort((a, b) => b.change24h - a.change24h).slice(0, 4),
    topLosers: [...fallbackItems].sort((a, b) => a.change24h - b.change24h).slice(0, 4),
    topVolume: [...fallbackItems].sort((a, b) => b.volume24hUsd - a.volume24hUsd).slice(0, 4),
    trending: fallbackItems.slice(0, 6).map((coin, index) => ({
      id: coin.id,
      symbol: coin.symbol,
      name: coin.name,
      image: coin.image,
      rank: index + 1,
    })),
    newListings: [
      { id: "pixelverse-token", symbol: "PIX", name: "Pixelverse Token" },
      { id: "yield-labs", symbol: "YLD", name: "Yield Labs" },
      { id: "quantum-net", symbol: "QNTX", name: "Quantum Net" },
    ],
    updatedAt,
  };
};

export const fallbackCoinDetail = (symbol: string): CoinDetailResponse => {
  const found = fallbackItems.find((item) => item.symbol.toLowerCase() === symbol.toLowerCase()) ?? fallbackItems[0];
  return {
    id: found.id,
    symbol: found.symbol.toUpperCase(),
    name: found.name,
    image: found.image,
    description:
      `${found.name} detail data is running in fallback mode because the external provider could not be reached.`,
    currentPriceUsd: found.currentPriceUsd,
    marketCapUsd: found.marketCapUsd,
    volume24hUsd: found.volume24hUsd,
    high24hUsd: found.high24hUsd,
    low24hUsd: found.low24hUsd,
    change24h: found.change24h,
    circulatingSupply: found.circulatingSupply,
    totalSupply: found.totalSupply,
    maxSupply: null,
    sparkline7d: found.sparkline7d,
    homepage: "",
    categories: [],
    related: fallbackItems
      .filter((item) => item.id !== found.id)
      .slice(0, 5)
      .map((item, index) => ({
        id: item.id,
        symbol: item.symbol,
        name: item.name,
        image: item.image,
        rank: index + 1,
      })),
    pairs: [
      {
        market: "Spot",
        base: found.symbol,
        target: "USDT",
        last: found.currentPriceUsd,
        volume: found.volume24hUsd,
        trustScore: "yellow",
      },
    ],
    updatedAt: new Date().toISOString(),
  };
};
