import { v4 as uuid } from "uuid";
import { db } from "../services/demoDb.js";
import { getMarketBySymbol } from "../services/marketService.js";

export const createOrder = (req, res) => {
  const { symbol, side, orderType, price, quantity } = req.validated.body;
  const market = getMarketBySymbol(symbol);

  if (!market) {
    return res.status(404).json({ message: "Trading pair is unavailable." });
  }

  const order = {
    id: uuid(),
    symbol,
    side,
    orderType,
    price: price || market.lastPrice,
    quantity,
    status: orderType === "market" ? "filled" : "open",
    createdAt: new Date().toISOString(),
  };

  db.orders[req.user.id] ||= [];
  db.tradeHistory[req.user.id] ||= [];
  db.orders[req.user.id].unshift(order);

  if (order.status === "filled") {
    db.tradeHistory[req.user.id].unshift({
      id: order.id,
      symbol,
      side,
      price: order.price,
      quantity,
      fee: Number((order.price * quantity * 0.001).toFixed(2)),
      time: order.createdAt,
    });
  }

  return res.status(201).json({ order, message: "Demo order submitted successfully." });
};

export const getOpenOrders = (req, res) =>
  res.json({ items: (db.orders[req.user.id] || []).filter((item) => item.status !== "filled") });

export const getTradeHistory = (req, res) => res.json({ items: db.tradeHistory[req.user.id] || [] });

