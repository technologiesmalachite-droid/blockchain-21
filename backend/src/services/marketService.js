import { calcPercent, randomBetween } from "../utils/helpers.js";
import { marketsRepository } from "../repositories/marketsRepository.js";

const normalizeMarket = (pair) => ({
  symbol: pair.symbol,
  base: pair.baseAsset,
  quote: pair.quoteAsset,
  lastPrice: Number(pair.lastPrice),
  previousPrice: Number(pair.previousPrice),
  high24h: Number(pair.high24h),
  low24h: Number(pair.low24h),
  volume24h: Number(pair.volume24h),
  minOrderSize: Number(pair.minOrderSize),
  pricePrecision: Number(pair.pricePrecision),
  quantityPrecision: Number(pair.quantityPrecision),
});

export const listMarkets = async () => {
  const pairs = await marketsRepository.list();

  return pairs.map((pair) => {
    const normalized = normalizeMarket(pair);

    return {
      ...normalized,
      change24h: calcPercent(normalized.lastPrice, normalized.previousPrice),
    };
  });
};

export const getMarketBySymbol = async (symbol) => {
  const pair = await marketsRepository.findBySymbol(symbol);

  if (!pair) return null;

  const normalized = normalizeMarket(pair);

  return {
    ...normalized,
    change24h: calcPercent(normalized.lastPrice, normalized.previousPrice),
    orderBook: Array.from({ length: 12 }).map((_, index) => ({
      bid: Number((normalized.lastPrice - index * randomBetween(2, 12)).toFixed(2)),
      ask: Number((normalized.lastPrice + index * randomBetween(2, 12)).toFixed(2)),
      size: randomBetween(0.2, 8),
    })),
    recentTrades: Array.from({ length: 15 }).map((_, index) => ({
      id: `${normalized.symbol}-${index}`,
      price: Number((normalized.lastPrice + randomBetween(-40, 40)).toFixed(2)),
      qty: randomBetween(0.01, 4),
      side: index % 2 === 0 ? "buy" : "sell",
      time: new Date(Date.now() - index * 60000).toISOString(),
    })),
  };
};
