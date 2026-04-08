import { calcPercent, randomBetween } from "../utils/helpers.js";
import { db } from "./demoDb.js";

export const listMarkets = () =>
  db.marketPairs.map((pair) => ({
    ...pair,
    change24h: calcPercent(pair.lastPrice, pair.previousPrice),
  }));

export const getMarketBySymbol = (symbol) => {
  const pair = db.marketPairs.find((item) => item.symbol === symbol.toUpperCase());

  if (!pair) return null;

  return {
    ...pair,
    change24h: calcPercent(pair.lastPrice, pair.previousPrice),
    orderBook: Array.from({ length: 12 }).map((_, index) => ({
      bid: Number((pair.lastPrice - index * randomBetween(2, 12)).toFixed(2)),
      ask: Number((pair.lastPrice + index * randomBetween(2, 12)).toFixed(2)),
      size: randomBetween(0.2, 8),
    })),
    recentTrades: Array.from({ length: 15 }).map((_, index) => ({
      id: `${pair.symbol}-${index}`,
      price: Number((pair.lastPrice + randomBetween(-40, 40)).toFixed(2)),
      qty: randomBetween(0.01, 4),
      side: index % 2 === 0 ? "buy" : "sell",
      time: new Date(Date.now() - index * 60000).toISOString(),
    })),
  };
};

