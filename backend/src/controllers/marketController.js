import { getMarketBySymbol, listMarkets } from "../services/marketService.js";

export const getMarkets = (_req, res) => res.json({ items: listMarkets() });

export const getMarketDetails = (req, res) => {
  const market = getMarketBySymbol(req.params.symbol);

  if (!market) {
    return res.status(404).json({ message: "Market symbol not found." });
  }

  return res.json({ item: market });
};

