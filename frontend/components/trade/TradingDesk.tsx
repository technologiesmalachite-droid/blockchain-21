"use client";

import { useEffect, useMemo, useState } from "react";
import { UnauthorizedStateCard } from "@/components/auth/UnauthorizedStateCard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { orderBook, recentTrades } from "@/data/demo";
import {
  fetchOpenPositions,
  fetchTradeHistory,
  fetchTradeQuote,
  fetchWalletBalances,
  placeTradeOrder,
  type OpenPosition,
  type TradeHistoryItem,
  type TradeQuote,
  type WalletBalance,
} from "@/lib/api/private-data";
import { useAuth } from "@/lib/auth-provider";
import { useDemo } from "@/lib/demo-provider";
import { formatCurrency, formatNumber } from "@/lib/utils";

const orderTypes = ["market", "limit"] as const;

export function TradingDesk() {
  const { status } = useAuth();
  const { submitToast } = useDemo();

  const [orderType, setOrderType] = useState<(typeof orderTypes)[number]>("limit");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [walletType, setWalletType] = useState<"spot" | "funding">("spot");
  const [quantity, setQuantity] = useState("0.02");
  const [price, setPrice] = useState("68235");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [quote, setQuote] = useState<TradeQuote | null>(null);
  const [orders, setOrders] = useState<OpenPosition[]>([]);
  const [tradeHistory, setTradeHistory] = useState<TradeHistoryItem[]>([]);
  const [balances, setBalances] = useState<WalletBalance[]>([]);

  const parsedQuantity = Number(quantity);
  const parsedPrice = Number(price);

  const loadPrivateTradingData = async () => {
    if (status !== "authenticated") {
      setOrders([]);
      setTradeHistory([]);
      setBalances([]);
      return;
    }

    setLoading(true);

    try {
      const [openOrders, history, wallet] = await Promise.all([
        fetchOpenPositions(),
        fetchTradeHistory(),
        fetchWalletBalances(),
      ]);

      setOrders(openOrders.items || []);
      setTradeHistory(history.items || []);
      setBalances(wallet.balances || []);
    } catch {
      submitToast("Trading data unavailable", "We couldn't load your latest trading state. Please refresh.");
    } finally {
      setLoading(false);
    }
  };

  const requestQuote = async () => {
    if (status !== "authenticated") {
      return;
    }

    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      return;
    }

    if (orderType === "limit" && (!Number.isFinite(parsedPrice) || parsedPrice <= 0)) {
      return;
    }

    try {
      const response = await fetchTradeQuote({
        symbol,
        side,
        orderType,
        quantity: parsedQuantity,
        price: orderType === "market" ? undefined : parsedPrice,
      });

      setQuote(response.quote);
    } catch {
      setQuote(null);
    }
  };

  useEffect(() => {
    loadPrivateTradingData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useEffect(() => {
    requestQuote();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, side, orderType, quantity, price, symbol]);

  const submitOrder = async () => {
    if (status !== "authenticated") {
      submitToast("Authentication required", "Sign in to place orders.");
      return;
    }

    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      submitToast("Invalid quantity", "Enter a valid quantity before placing the order.");
      return;
    }

    if (orderType === "limit" && (!Number.isFinite(parsedPrice) || parsedPrice <= 0)) {
      submitToast("Invalid limit price", "Enter a valid limit price to continue.");
      return;
    }

    setBusy(true);

    try {
      await placeTradeOrder({
        symbol,
        side,
        orderType,
        quantity: parsedQuantity,
        price: orderType === "market" ? undefined : parsedPrice,
        walletType,
      });

      submitToast("Order accepted", `${side.toUpperCase()} ${symbol} order has been submitted.`);
      await loadPrivateTradingData();
      await requestQuote();
    } catch {
      submitToast("Order rejected", "We couldn't place this order. Check balance, KYC, and verification status.");
    } finally {
      setBusy(false);
    }
  };

  const availableBalanceLabel = useMemo(() => {
    if (!quote) {
      return "--";
    }

    const debitAsset = quote.settlement.debitAsset;
    const row = balances.find((item) => item.asset === debitAsset && item.walletType === walletType);

    if (!row) {
      return `0 ${debitAsset}`;
    }

    return `${formatNumber(row.available, 8)} ${debitAsset}`;
  }, [balances, quote, walletType]);

  if (status !== "authenticated") {
    return (
      <UnauthorizedStateCard
        title="Sign in to trade"
        subtitle="Login or create an account to place spot orders, monitor execution history, and manage balances."
      />
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr_0.9fr]">
      <Card className="p-0">
        <div className="border-b border-white/10 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm text-muted">Trading pair</p>
              <h2 className="mt-1 text-2xl font-semibold text-white">BTC/USDT</h2>
            </div>
            <div className="flex gap-6 text-sm">
              <div><p className="text-muted">Last price</p><p className="font-medium text-white">{formatCurrency(68241.22)}</p></div>
              <div><p className="text-muted">24h high</p><p className="font-medium text-white">{formatCurrency(68990.44)}</p></div>
              <div><p className="text-muted">24h volume</p><p className="font-medium text-white">{formatNumber(84215.22)}</p></div>
            </div>
          </div>
        </div>

        <div className="grid gap-5 p-5 lg:grid-cols-2">
          <Card className="p-4">
            <p className="mb-3 text-sm text-muted">Order book</p>
            <div className="space-y-2 text-sm">
              {orderBook.map((row, index) => (
                <div key={index} className="grid grid-cols-3 gap-3 text-right">
                  <span className="text-emerald-400">{row.bid.toFixed(2)}</span>
                  <span className="text-rose-400">{row.ask.toFixed(2)}</span>
                  <span className="text-muted">{row.amount.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-4">
            <p className="mb-3 text-sm text-muted">Recent trades</p>
            <div className="space-y-2 text-sm">
              {recentTrades.map((trade, index) => (
                <div key={index} className="grid grid-cols-3 gap-3">
                  <span className={trade.side === "Buy" ? "text-emerald-400" : "text-rose-400"}>{trade.price}</span>
                  <span className="text-white">{trade.size.toFixed(2)}</span>
                  <span className="text-muted">{trade.time}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="grid gap-5 border-t border-white/10 p-5 lg:grid-cols-2">
          <Card className="p-4">
            <p className="mb-4 text-sm text-muted">Open orders</p>
            {loading ? (
              <p className="text-sm text-muted">Loading open orders...</p>
            ) : !orders.length ? (
              <p className="text-sm text-muted">No open spot orders.</p>
            ) : (
              <div className="space-y-3">
                {orders.slice(0, 4).map((order) => (
                  <div key={order.id} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-muted">
                    <span className="text-white">{order.symbol}</span> {order.side.toUpperCase()} {order.quantity} @ {order.price} ({order.status})
                  </div>
                ))}
              </div>
            )}
          </Card>
          <Card className="p-4">
            <p className="mb-4 text-sm text-muted">Trade history</p>
            {loading ? (
              <p className="text-sm text-muted">Loading fills...</p>
            ) : !tradeHistory.length ? (
              <p className="text-sm text-muted">No recent fills.</p>
            ) : (
              <div className="space-y-3">
                {tradeHistory.slice(0, 4).map((trade) => (
                  <div key={trade.id} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-muted">
                    <span className="text-white">{trade.symbol}</span> {trade.side.toUpperCase()} {trade.quantity} @ {trade.price} fee {trade.fee}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </Card>

      <Card>
        <p className="text-sm text-muted">Place order</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button onClick={() => setSide("buy")} className={`rounded-xl px-3 py-2 text-sm ${side === "buy" ? "bg-emerald-400 text-slate-950" : "bg-white/5 text-muted"}`}>Buy</button>
          <button onClick={() => setSide("sell")} className={`rounded-xl px-3 py-2 text-sm ${side === "sell" ? "bg-rose-400 text-slate-950" : "bg-white/5 text-muted"}`}>Sell</button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {orderTypes.map((type) => (
            <button
              key={type}
              onClick={() => setOrderType(type)}
              className={`rounded-xl px-3 py-2 text-sm ${orderType === type ? "bg-white text-slate-950" : "bg-white/5 text-muted"}`}
            >
              {type}
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-4">
          <select value={symbol} onChange={(event) => setSymbol(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white">
            <option value="BTCUSDT">BTCUSDT</option>
            <option value="ETHUSDT">ETHUSDT</option>
            <option value="SOLUSDT">SOLUSDT</option>
          </select>

          <select
            value={walletType}
            onChange={(event) => setWalletType(event.target.value as "spot" | "funding")}
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white"
          >
            <option value="spot">Spot wallet</option>
            <option value="funding">Funding wallet</option>
          </select>

          <label className="block">
            <span className="mb-2 block text-sm text-muted">Quantity</span>
            <input value={quantity} onChange={(e) => setQuantity(e.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none" />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm text-muted">Price</span>
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              disabled={orderType === "market"}
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none disabled:opacity-60"
            />
          </label>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-muted">
            Available: {availableBalanceLabel}
          </div>

          {quote ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-muted">
              <p>Estimated notional: <span className="text-white">{formatNumber(quote.notional, 4)} {quote.settlement.debitAsset}</span></p>
              <p className="mt-1">Estimated fee: <span className="text-white">{formatNumber(quote.fee, 6)} {quote.settlement.debitAsset}</span></p>
              <p className="mt-1">You receive: <span className="text-white">{formatNumber(quote.settlement.creditAmount, 8)} {quote.settlement.creditAsset}</span></p>
            </div>
          ) : null}

          <Button className="w-full py-3" onClick={submitOrder} disabled={busy}>
            {busy ? "Submitting order..." : `Submit ${side} order`}
          </Button>
        </div>
      </Card>

      <div className="space-y-6">
        <Card>
          <p className="text-sm text-muted">Wallet balances</p>
          <div className="mt-4 space-y-3 text-sm">
            {balances.slice(0, 6).map((row) => (
              <div key={`${row.walletType}-${row.asset}`} className="flex justify-between">
                <span className="text-muted">{row.walletType.toUpperCase()} {row.asset}</span>
                <span className="text-white">{formatNumber(row.available, 8)}</span>
              </div>
            ))}
            {!balances.length ? <p className="text-sm text-muted">No balances available.</p> : null}
          </div>
        </Card>
        <Card>
          <p className="text-sm text-muted">Risk controls</p>
          <p className="mt-3 text-sm leading-7 text-muted">
            Order placement enforces authentication, contact verification, KYC status, and wallet balance checks before execution.
          </p>
        </Card>
      </div>
    </div>
  );
}
