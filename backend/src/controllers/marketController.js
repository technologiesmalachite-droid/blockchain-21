import { getMarketBySymbol, listMarkets } from "../services/marketService.js";
import { getBinanceMarketsSnapshot } from "../services/binanceMarketService.js";
import { getOrderBook } from "../services/tradingEngine.js";

export const getMarkets = async (_req, res) => {
  const items = await listMarkets();
  return res.json({ items });
};

export const getMarketDetails = async (req, res) => {
  const market = await getMarketBySymbol(req.params.symbol);

  if (!market) {
    return res.status(404).json({ message: "Market symbol not found." });
  }

  return res.json({ item: market });
};

export const getBinanceMarkets = async (_req, res) => {
  try {
    const snapshot = await getBinanceMarketsSnapshot();
    return res.json(snapshot);
  } catch {
    return res.status(503).json({
      message: "Binance market feed is temporarily unavailable. Please try again shortly.",
      source: "binance",
      stale: true,
      items: [],
      updatedAt: new Date().toISOString(),
    });
  }
};

export const getSpotOrderBook = async (req, res) => {
  try {
    const symbol = String(req.query.symbol || "").toUpperCase().trim();
    const depth = Number(req.query.depth || 20);

    if (!symbol) {
      return res.status(400).json({ message: "symbol query parameter is required." });
    }

    const snapshot = await getOrderBook(symbol, Number.isFinite(depth) ? Math.max(1, Math.min(depth, 100)) : 20);
    return res.json(snapshot);
  } catch (error) {
    return res.status(400).json({ message: error.message || "Unable to load order book." });
  }
};
