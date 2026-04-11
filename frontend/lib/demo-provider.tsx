"use client";

import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { balances, marketData, transactions } from "@/data/demo";

type Toast = { id: number; title: string; description: string };
type Order = { id: number; symbol: string; side: "buy" | "sell"; orderType: string; quantity: string; price: string; status: string };
type Transaction = (typeof transactions)[number];

type DemoContextType = {
  favorites: string[];
  toggleFavorite: (symbol: string) => void;
  submitToast: (title: string, description: string) => void;
  toasts: Toast[];
  balances: typeof balances;
  transactions: Transaction[];
  markets: typeof marketData;
  orders: Order[];
  tradeHistory: Order[];
  addTransaction: (transaction: Omit<Transaction, "id" | "date">) => void;
  placeOrder: (payload: Omit<Order, "id" | "status">) => void;
};

const DemoContext = createContext<DemoContextType | null>(null);

export function DemoProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState<string[]>(["BTCUSDT", "ETHUSDT"]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [markets, setMarkets] = useState(marketData);
  const [transactionsState, setTransactionsState] = useState(transactions);
  const [orders, setOrders] = useState<Order[]>([
    { id: 1, symbol: "BTCUSDT", side: "buy", orderType: "limit", quantity: "0.12", price: "67500", status: "open" },
  ]);
  const [tradeHistory, setTradeHistory] = useState<Order[]>([
    { id: 2, symbol: "SOLUSDT", side: "buy", orderType: "market", quantity: "25", price: "160.12", status: "filled" },
  ]);

  const toggleFavorite = (symbol: string) => {
    setFavorites((current) => (current.includes(symbol) ? current.filter((item) => item !== symbol) : [...current, symbol]));
  };

  const submitToast = (title: string, description: string) => {
    const id = Date.now();
    setToasts((current) => [...current, { id, title, description }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 3200);
  };

  const addTransaction = (transaction: Omit<Transaction, "id" | "date">) => {
    setTransactionsState((current) => [
      {
        ...transaction,
        id: `tx-${Date.now()}`,
        date: new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC",
      },
      ...current,
    ]);
  };

  const placeOrder = (payload: Omit<Order, "id" | "status">) => {
    const status = payload.orderType === "market" ? "filled" : "open";
    const nextOrder = { ...payload, id: Date.now(), status };
    if (status === "filled") {
      setTradeHistory((current) => [nextOrder, ...current]);
      return;
    }
    setOrders((current) => [nextOrder, ...current]);
  };

  useEffect(() => {
    const interval = window.setInterval(() => {
      setMarkets((current) =>
        current.map((item) => {
          const drift = Number((Math.random() * 0.8 - 0.4).toFixed(2));
          const nextPrice = Number((item.lastPrice * (1 + drift / 100)).toFixed(item.lastPrice > 1 ? 2 : 4));
          return {
            ...item,
            lastPrice: nextPrice,
            change24h: Number((item.change24h + drift / 2).toFixed(2)),
          };
        }),
      );
    }, 4000);

    return () => window.clearInterval(interval);
  }, []);

  const value = useMemo(
    () => ({
      favorites,
      toggleFavorite,
      submitToast,
      toasts,
      balances,
      transactions: transactionsState,
      markets,
      orders,
      tradeHistory,
      addTransaction,
      placeOrder,
    }),
    [favorites, toasts, transactionsState, markets, orders, tradeHistory],
  );

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo() {
  const context = useContext(DemoContext);

  if (!context) {
    throw new Error("useDemo must be used inside DemoProvider.");
  }

  return context;
}
