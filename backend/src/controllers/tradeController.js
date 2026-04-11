import {
  cancelSpotOrder,
  convertAsset,
  createTradeQuote,
  listOpenOrders,
  listTradeHistory,
  placeSpotOrder,
} from "../services/tradingEngine.js";

export const createQuote = async (req, res) => {
  try {
    const quote = await createTradeQuote(req.validated.body);
    return res.json({ quote });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

export const createOrder = async (req, res) => {
  try {
    const result = await placeSpotOrder({
      user: req.user,
      symbol: req.validated.body.symbol,
      side: req.validated.body.side,
      orderType: req.validated.body.orderType,
      quantity: req.validated.body.quantity,
      price: req.validated.body.price,
      walletType: req.validated.body.walletType || "spot",
    });

    return res.status(201).json({ order: result.order, quote: result.quote, message: "Order accepted." });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

export const cancelOrder = async (req, res) => {
  try {
    const order = await cancelSpotOrder({
      user: req.user,
      orderId: req.params.orderId,
    });

    return res.json({ order, message: "Order cancelled." });
  } catch (error) {
    return res.status(404).json({ message: error.message });
  }
};

export const createConversion = async (req, res) => {
  try {
    const trade = await convertAsset({
      user: req.user,
      fromAsset: req.validated.body.fromAsset,
      toAsset: req.validated.body.toAsset,
      amount: req.validated.body.amount,
      walletType: req.validated.body.walletType || "spot",
    });

    return res.status(201).json({ trade, message: "Asset conversion completed." });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

export const getOpenOrders = async (req, res) => res.json({ items: await listOpenOrders(req.user.id) });

export const getTradeHistory = async (req, res) => res.json({ items: await listTradeHistory(req.user.id) });
