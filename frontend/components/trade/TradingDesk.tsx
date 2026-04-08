"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { orderBook, recentTrades } from "@/data/demo";
import { useDemo } from "@/lib/demo-provider";
import { formatCurrency, formatNumber } from "@/lib/utils";

const orderTypes = ["market", "limit", "stop-limit"] as const;

export function TradingDesk() {
  const [orderType, setOrderType] = useState<(typeof orderTypes)[number]>("limit");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [quantity, setQuantity] = useState("0.12");
  const [price, setPrice] = useState("68235");
  const { submitToast, orders, tradeHistory, placeOrder } = useDemo();

  return (
    <div className="grid gap-6 xl:grid-cols-[1.5fr_0.7fr_0.8fr]">
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
        <div className="grid gap-6 p-5 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-muted">Candlestick chart</p>
              <div className="rounded-full border border-white/10 px-3 py-1 text-xs text-muted">TradingView/custom widget ready</div>
            </div>
            <div className="grid h-80 grid-cols-12 items-end gap-2">
              {Array.from({ length: 32 }).map((_, index) => (
                <div
                  key={index}
                  className={`rounded-t-xl ${index % 5 === 0 ? "bg-rose-400/80" : "bg-emerald-400/80"}`}
                  style={{ height: `${35 + ((index * 17) % 60)}%` }}
                />
              ))}
            </div>
          </div>
          <div className="space-y-6">
            <Card className="p-4">
              <p className="mb-4 text-sm text-muted">Order book</p>
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
              <p className="mb-4 text-sm text-muted">Recent trades</p>
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
        </div>
        <div className="grid gap-6 border-t border-white/10 p-5 lg:grid-cols-2">
          <Card className="p-4">
            <p className="mb-4 text-sm text-muted">Open orders</p>
            <div className="space-y-3">
              {orders.slice(0, 3).map((order) => (
                <div key={order.id} className="rounded-2xl border border-white/10 p-4 text-sm text-muted">
                  {order.symbol} {order.orderType} {order.side} {order.quantity} @ {order.price}. Status: {order.status}.
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-4">
            <p className="mb-4 text-sm text-muted">Trade history</p>
            <div className="space-y-3">
              {tradeHistory.slice(0, 3).map((trade) => (
                <div key={trade.id} className="rounded-2xl border border-white/10 p-4 text-sm text-muted">
                  {trade.symbol} {trade.side} {trade.quantity} @ {trade.price}. Status: {trade.status}.
                </div>
              ))}
            </div>
          </Card>
        </div>
      </Card>

      <Card>
        <p className="text-sm text-muted">Buy / Sell</p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {orderTypes.map((type) => (
            <button key={type} onClick={() => setOrderType(type)} className={`rounded-xl px-3 py-2 text-sm ${orderType === type ? "bg-white text-slate-950" : "bg-white/5 text-muted"}`}>
              {type}
            </button>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button onClick={() => setSide("buy")} className={`rounded-xl px-3 py-2 text-sm ${side === "buy" ? "bg-emerald-400 text-slate-950" : "bg-white/5 text-muted"}`}>Buy</button>
          <button onClick={() => setSide("sell")} className={`rounded-xl px-3 py-2 text-sm ${side === "sell" ? "bg-rose-400 text-slate-950" : "bg-white/5 text-muted"}`}>Sell</button>
        </div>
        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm text-muted">Price</span>
            <input value={price} onChange={(e) => setPrice(e.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none" />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm text-muted">Quantity</span>
            <input value={quantity} onChange={(e) => setQuantity(e.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none" />
          </label>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-muted">
            Available balance: 18,880.12 USDT
          </div>
          <Button
            className="w-full py-3"
            onClick={() => {
              placeOrder({ symbol: "BTCUSDT", side, orderType, quantity, price });
              submitToast(`${side === "buy" ? "Buy" : "Sell"} order placed`, `${orderType} order submitted with demo execution logic.`);
            }}
          >
            Submit {side} order
          </Button>
        </div>
      </Card>

      <div className="space-y-6">
        <Card>
          <p className="text-sm text-muted">Asset balances</p>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-muted">USDT</span><span className="text-white">18,880.12</span></div>
            <div className="flex justify-between"><span className="text-muted">BTC</span><span className="text-white">0.7462</span></div>
            <div className="flex justify-between"><span className="text-muted">ETH</span><span className="text-white">6.182</span></div>
          </div>
        </Card>
        <Card>
          <p className="text-sm text-muted">Mobile layout note</p>
          <p className="mt-3 text-sm leading-7 text-muted">On smaller screens, market data stacks beneath the chart and the order panel moves to the bottom for touch-friendly use.</p>
        </Card>
      </div>
    </div>
  );
}
