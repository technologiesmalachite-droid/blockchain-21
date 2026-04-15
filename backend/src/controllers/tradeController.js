import {
  cancelSpotOrder,
  convertAsset,
  createTradeQuote,
  listUserOrders,
  listOpenOrders,
  listTradeHistory,
  placeSpotOrder,
} from "../services/tradingEngine.js";

const isInfrastructureIssue = (error) => {
  if (!error) {
    return false;
  }

  const code = typeof error.code === "string" ? error.code : "";
  const networkCodes = new Set(["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "EPIPE", "57P01", "57P03"]);
  const dbCodes = /^(08|53|57|3D|XX)/;
  const message = typeof error.message === "string" ? error.message.toLowerCase() : "";

  return (
    networkCodes.has(code) ||
    dbCodes.test(code) ||
    message.includes("database") ||
    message.includes("connection") ||
    message.includes("connect") ||
    message.includes("timeout")
  );
};

const sendTradingError = (res, error, fallbackMessage, fallbackStatus = 400) => {
  if (isInfrastructureIssue(error)) {
    return res.status(503).json({
      message: "Trading service is temporarily unavailable. Please try again shortly.",
    });
  }

  const status = Number.isInteger(error?.statusCode) ? error.statusCode : fallbackStatus;
  const message = typeof error?.message === "string" && error.message.trim() ? error.message : fallbackMessage;
  return res.status(status).json({ message });
};

export const createQuote = async (req, res) => {
  try {
    const quote = await createTradeQuote(req.validated.body);
    return res.json({ quote });
  } catch (error) {
    return sendTradingError(res, error, "Unable to generate quote.");
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
    return sendTradingError(res, error, "Unable to place order.");
  }
};

export const cancelOrder = async (req, res) => {
  try {
    const order = await cancelSpotOrder({
      user: req.user,
      orderId: req.params.orderId || req.params.id,
    });

    return res.json({ order, message: "Order cancelled." });
  } catch (error) {
    return sendTradingError(res, error, "Unable to cancel order.", 404);
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
    return sendTradingError(res, error, "Unable to process conversion.");
  }
};

export const getOpenOrders = async (req, res) => res.json({ items: await listOpenOrders(req.user.id) });

export const getOrders = async (req, res) => res.json({ items: await listUserOrders(req.user.id) });

export const getTradeHistory = async (req, res) => res.json({ items: await listTradeHistory(req.user.id) });
