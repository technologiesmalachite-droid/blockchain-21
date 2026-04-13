import { getMarketBySymbol, listMarkets } from "../services/marketService.js";
import { getBinanceMarketsSnapshot } from "../services/binanceMarketService.js";

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
