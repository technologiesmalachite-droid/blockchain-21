"use client";

import { useEffect, useMemo, useState } from "react";
import { UnauthorizedStateCard } from "@/components/auth/UnauthorizedStateCard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  cancelTradeOrder,
  fetchOpenPositions,
  fetchTradeHistory,
  fetchTradeOrderBook,
  fetchTradeQuote,
  fetchTradingPairs,
  fetchUserOrders,
  fetchWalletBalances,
  placeTradeOrder,
  type MarketSummary,
  type OpenPosition,
  type OrderBookSnapshot,
  type TradeHistoryItem,
  type TradeQuote,
  type WalletBalance,
} from "@/lib/api/private-data";
import { useAuth } from "@/lib/auth-provider";
import { useDemo } from "@/lib/demo-provider";
import { formatCurrency, formatNumber } from "@/lib/utils";

const orderTypes = ["market", "limit"] as const;
const PAGE_SIZE = 5;

const safeCurrency = (value: number | null | undefined) => (value == null ? "--" : formatCurrency(value));

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
  const [openOrders, setOpenOrders] = useState<OpenPosition[]>([]);
  const [tradeHistory, setTradeHistory] = useState<TradeHistoryItem[]>([]);
  const [balances, setBalances] = useState<WalletBalance[]>([]);
  const [markets, setMarkets] = useState<MarketSummary[]>([]);
  const [book, setBook] = useState<OrderBookSnapshot | null>(null);
  const [ordersPage, setOrdersPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const [cancelBusyId, setCancelBusyId] = useState<string | null>(null);

  const parsedQuantity = Number(quantity);
  const parsedPrice = Number(price);

  const activeMarket = useMemo(
    () => markets.find((item) => item.symbol === symbol) || null,
    [markets, symbol],
  );

  const loadPrivateTradingData = async (showSpinner = true) => {
    if (status !== "authenticated") {
      setOrders([]);
      setOpenOrders([]);
      setTradeHistory([]);
      setBalances([]);
      return;
    }

    if (showSpinner) {
      setLoading(true);
    }

    try {
      const [allOrdersResponse, openOrdersResponse, history, wallet] = await Promise.all([
        fetchUserOrders(),
        fetchOpenPositions(),
        fetchTradeHistory(),
        fetchWalletBalances(),
      ]);

      setOrders(allOrdersResponse.items || []);
      setOpenOrders(openOrdersResponse.items || []);
      setTradeHistory(history.items || []);
      setBalances(wallet.balances || []);
    } catch {
      submitToast("Trading data unavailable", "We couldn't load your latest trading state. Please refresh.");
    } finally {
      if (showSpinner) {
        setLoading(false);
      }
    }
  };

  const loadPublicTradingData = async (nextSymbol: string, showErrors = false) => {
    try {
      const [pairs, orderBook] = await Promise.all([
        fetchTradingPairs(),
        fetchTradeOrderBook(nextSymbol, 20),
      ]);

      if (pairs.items?.length) {
        setMarkets(pairs.items);

        const exists = pairs.items.some((item) => item.symbol === nextSymbol);
        if (!exists) {
          setSymbol(pairs.items[0].symbol);
        }
      }

      setBook(orderBook);
    } catch {
      if (showErrors) {
        submitToast("Order book unavailable", "Unable to load market depth at the moment.");
      }
    }
  };

  const requestQuote = async () => {
    if (status !== "authenticated") {
      return;
    }

    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      setQuote(null);
      return;
    }

    if (orderType === "limit" && (!Number.isFinite(parsedPrice) || parsedPrice <= 0)) {
      setQuote(null);
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
    if (status !== "authenticated") {
      setLoading(false);
      return;
    }

    loadPrivateTradingData();
    loadPublicTradingData(symbol, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }

    loadPublicTradingData(symbol);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }

    requestQuote();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, side, orderType, quantity, price, symbol]);

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }

    const timer = window.setInterval(() => {
      loadPrivateTradingData(false);
      loadPublicTradingData(symbol);
    }, 5000);

    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, symbol]);

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
      await loadPrivateTradingData(false);
      await loadPublicTradingData(symbol);
      await requestQuote();
    } catch {
      submitToast("Order rejected", "We couldn't place this order. Check balance, KYC, and verification status.");
    } finally {
      setBusy(false);
    }
  };

  const cancelOrder = async (orderId: string) => {
    setCancelBusyId(orderId);
    try {
      await cancelTradeOrder(orderId);
      submitToast("Order cancelled", "Locked funds were released for this order.");
      await loadPrivateTradingData(false);
      await loadPublicTradingData(symbol);
    } catch {
      submitToast("Cancel failed", "Unable to cancel this order right now.");
    } finally {
      setCancelBusyId(null);
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

  const pagedOpenOrders = useMemo(() => {
    const start = (ordersPage - 1) * PAGE_SIZE;
    return openOrders.slice(start, start + PAGE_SIZE);
  }, [openOrders, ordersPage]);

  const pagedHistory = useMemo(() => {
    const start = (historyPage - 1) * PAGE_SIZE;
    return tradeHistory.slice(start, start + PAGE_SIZE);
  }, [tradeHistory, historyPage]);

  const totalOrderPages = Math.max(1, Math.ceil(openOrders.length / PAGE_SIZE));
  const totalHistoryPages = Math.max(1, Math.ceil(tradeHistory.length / PAGE_SIZE));

  useEffect(() => {
    setOrdersPage((current) => Math.min(current, totalOrderPages));
  }, [totalOrderPages]);

  useEffect(() => {
    setHistoryPage((current) => Math.min(current, totalHistoryPages));
  }, [totalHistoryPages]);

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
              <h2 className="mt-1 text-2xl font-semibold text-white">
                {symbol.replace("USDT", "/USDT")}
              </h2>
            </div>
            <div className="flex gap-6 text-sm">
              <div><p className="text-muted">Last price</p><p className="font-medium text-white">{safeCurrency(activeMarket?.lastPrice)}</p></div>
              <div><p className="text-muted">24h high</p><p className="font-medium text-white">{safeCurrency(activeMarket?.high24h)}</p></div>
              <div><p className="text-muted">24h volume</p><p className="font-medium text-white">{activeMarket ? formatNumber(activeMarket.volume24h) : "--"}</p></div>
            </div>
          </div>
        </div>

        <div className="grid gap-5 p-5 lg:grid-cols-2">
          <Card className="p-4">
            <p className="mb-3 text-sm text-muted">Order book</p>
            {!book ? (
              <p className="text-sm text-muted">Loading order book...</p>
            ) : (
              <div className="space-y-2 text-sm">
                {Array.from({ length: 12 }).map((_, index) => {
                  const bid = book.bids[index];
                  const ask = book.asks[index];
                  return (
                    <div key={`${index}-${bid?.price || "b"}-${ask?.price || "a"}`} className="grid grid-cols-3 gap-3 text-right">
                      <span className="text-emerald-400">{bid ? bid.price.toFixed(2) : "--"}</span>
                      <span className="text-rose-400">{ask ? ask.price.toFixed(2) : "--"}</span>
                      <span className="text-muted">{bid ? bid.quantity.toFixed(5) : ask ? ask.quantity.toFixed(5) : "--"}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
          <Card className="p-4">
            <p className="mb-3 text-sm text-muted">Recent trades</p>
            {!book?.recentTrades?.length ? (
              <p className="text-sm text-muted">No recent matched trades.</p>
            ) : (
              <div className="space-y-2 text-sm">
                {book.recentTrades.slice(0, 12).map((trade) => (
                  <div key={trade.id} className="grid grid-cols-3 gap-3">
                    <span className={trade.side === "buy" ? "text-emerald-400" : "text-rose-400"}>{trade.price.toFixed(2)}</span>
                    <span className="text-white">{trade.quantity.toFixed(5)}</span>
                    <span className="text-muted">{new Date(trade.time).toLocaleTimeString()}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="grid gap-5 border-t border-white/10 p-5 lg:grid-cols-2">
          <Card className="p-4">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-muted">Open orders</p>
              <p className="text-xs text-muted">Page {ordersPage}/{totalOrderPages}</p>
            </div>
            {loading ? (
              <p className="text-sm text-muted">Loading open orders...</p>
            ) : !pagedOpenOrders.length ? (
              <p className="text-sm text-muted">No open spot orders.</p>
            ) : (
              <div className="space-y-3">
                {pagedOpenOrders.map((order) => (
                  <div key={order.id} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-muted">
                    <p className="text-white">
                      {order.symbol} {order.side.toUpperCase()} {formatNumber(order.quantity, 8)} @ {order.price != null ? formatNumber(order.price, 8) : "MKT"}
                    </p>
                    <p className="mt-1">
                      Filled {formatNumber(order.filledQuantity || 0, 8)} / {formatNumber(order.quantity, 8)} | Locked {formatNumber(order.lockedAmount || 0, 8)}
                    </p>
                    <div className="mt-3">
                      <Button variant="ghost" onClick={() => cancelOrder(order.id)} disabled={cancelBusyId === order.id}>
                        {cancelBusyId === order.id ? "Cancelling..." : "Cancel"}
                      </Button>
                    </div>
                  </div>
                ))}
                <div className="flex justify-between pt-2">
                  <Button variant="ghost" onClick={() => setOrdersPage((page) => Math.max(1, page - 1))} disabled={ordersPage <= 1}>
                    Previous
                  </Button>
                  <Button variant="ghost" onClick={() => setOrdersPage((page) => Math.min(totalOrderPages, page + 1))} disabled={ordersPage >= totalOrderPages}>
                    Next
                  </Button>
                </div>
              </div>
            )}
          </Card>
          <Card className="p-4">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-muted">Trade history</p>
              <p className="text-xs text-muted">Page {historyPage}/{totalHistoryPages}</p>
            </div>
            {loading ? (
              <p className="text-sm text-muted">Loading fills...</p>
            ) : !pagedHistory.length ? (
              <p className="text-sm text-muted">No recent fills.</p>
            ) : (
              <div className="space-y-3">
                {pagedHistory.map((trade) => (
                  <div key={trade.id} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-muted">
                    <span className="text-white">{trade.symbol}</span> {trade.side.toUpperCase()} {formatNumber(trade.quantity, 8)} @ {formatNumber(trade.price, 8)} fee {formatNumber(trade.fee, 8)}
                  </div>
                ))}
                <div className="flex justify-between pt-2">
                  <Button variant="ghost" onClick={() => setHistoryPage((page) => Math.max(1, page - 1))} disabled={historyPage <= 1}>
                    Previous
                  </Button>
                  <Button variant="ghost" onClick={() => setHistoryPage((page) => Math.min(totalHistoryPages, page + 1))} disabled={historyPage >= totalHistoryPages}>
                    Next
                  </Button>
                </div>
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
            {markets.length ? (
              markets.map((item) => (
                <option key={item.symbol} value={item.symbol}>{item.symbol}</option>
              ))
            ) : (
              <option value={symbol}>{symbol}</option>
            )}
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
            <input value={quantity} onChange={(event) => setQuantity(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none" />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm text-muted">Price</span>
            <input
              value={price}
              onChange={(event) => setPrice(event.target.value)}
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
            Order placement enforces authentication, contact verification, KYC status, precision checks, balance lock, and price-time matching safety.
          </p>
          <p className="mt-2 text-xs text-muted">
            Total historical orders loaded: {orders.length}
          </p>
        </Card>
      </div>
    </div>
  );
}
