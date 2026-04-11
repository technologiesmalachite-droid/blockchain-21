import { getMarketBySymbol, listMarkets } from "../services/marketService.js";

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
