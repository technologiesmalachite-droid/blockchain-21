"use client";

import { useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ContentSection, PageHero } from "@/components/PageShell";
import { Card } from "@/components/ui/Card";
import { fetchOpenPositions, fetchTradeHistory, type OpenPosition, type TradeHistoryItem } from "@/lib/api/private-data";
import { useAuth } from "@/lib/auth-provider";
import { formatNumber } from "@/lib/utils";

type OrdersState = {
  loading: boolean;
  failed: boolean;
  openPositions: OpenPosition[];
  tradeHistory: TradeHistoryItem[];
};

const initialState: OrdersState = {
  loading: false,
  failed: false,
  openPositions: [],
  tradeHistory: [],
};

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Recent";
  }
  return date.toLocaleString();
};

export default function OrdersPage() {
  const { status } = useAuth();
  const [state, setState] = useState<OrdersState>(initialState);

  useEffect(() => {
    let active = true;

    if (status !== "authenticated") {
      setState(initialState);
      return () => {
        active = false;
      };
    }

    setState((current) => ({ ...current, loading: true, failed: false }));

    Promise.all([fetchOpenPositions(), fetchTradeHistory()])
      .then(([openPayload, historyPayload]) => {
        if (!active) {
          return;
        }

        setState({
          loading: false,
          failed: false,
          openPositions: openPayload.items || [],
          tradeHistory: historyPayload.items || [],
        });
      })
      .catch(() => {
        if (!active) {
          return;
        }

        setState({
          ...initialState,
          failed: true,
        });
      });

    return () => {
      active = false;
    };
  }, [status]);

  return (
    <>
      <PageHero
        eyebrow="Orders"
        title="Open orders and execution history"
        description="Track live order intent and completed fills from one protected order management view."
        badge="Private page"
      />
      <ContentSection>
        <ProtectedRoute>
          {state.loading ? (
            <Card className="border-white/15 bg-black/25">
              <p className="text-xl font-semibold text-white">Loading orders</p>
              <p className="mt-2 text-sm text-muted">Fetching your open orders and recent trade history.</p>
            </Card>
          ) : state.failed ? (
            <Card className="border-white/15 bg-black/25">
              <p className="text-xl font-semibold text-white">Unable to load orders</p>
              <p className="mt-2 text-sm text-muted">Please refresh the page or sign in again.</p>
            </Card>
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <p className="mb-4 text-lg font-semibold text-white">Open positions</p>
                {!state.openPositions.length ? (
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-muted">
                    No open positions yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {state.openPositions.map((order) => (
                      <div key={order.id} className="grid gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm md:grid-cols-3">
                        <span className="font-medium text-white">{order.symbol}</span>
                        <span className={order.side === "buy" ? "text-emerald-400" : "text-rose-400"}>{order.side.toUpperCase()}</span>
                        <span className="text-muted">{order.status}</span>
                        <span className="text-muted">Qty {formatNumber(order.quantity, 4)}</span>
                        <span className="text-muted">Price {order.price != null ? formatNumber(order.price, 2) : "MKT"}</span>
                        <span className="text-muted">{formatDate(order.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
              <Card>
                <p className="mb-4 text-lg font-semibold text-white">Trade history</p>
                {!state.tradeHistory.length ? (
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-muted">
                    No filled trades yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {state.tradeHistory.map((trade) => (
                      <div key={trade.id} className="grid gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm md:grid-cols-3">
                        <span className="font-medium text-white">{trade.symbol}</span>
                        <span className={trade.side === "buy" ? "text-emerald-400" : "text-rose-400"}>{trade.side.toUpperCase()}</span>
                        <span className="text-muted">{formatDate(trade.time)}</span>
                        <span className="text-muted">Qty {formatNumber(trade.quantity, 4)}</span>
                        <span className="text-muted">Price {formatNumber(trade.price, 2)}</span>
                        <span className="text-muted">Fee {formatNumber(trade.fee, 4)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          )}
        </ProtectedRoute>
      </ContentSection>
    </>
  );
}
