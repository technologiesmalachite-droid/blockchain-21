"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ContentSection, PageHero } from "@/components/PageShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { fetchP2pOrders, type P2POrder } from "@/lib/api/private-data";
import { useAuth } from "@/lib/auth-provider";
import { formatNumber } from "@/lib/utils";

const formatDateTime = (value?: string | null) => {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleString();
};

export default function P2POrdersPage() {
  const { status } = useAuth();
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [orders, setOrders] = useState<P2POrder[]>([]);
  const [filter, setFilter] = useState<"" | P2POrder["status"]>("");

  useEffect(() => {
    let active = true;

    if (status !== "authenticated") {
      setOrders([]);
      return () => {
        active = false;
      };
    }

    setLoading(true);
    setFailed(false);

    fetchP2pOrders({
      status: filter || undefined,
      page: 1,
      pageSize: 50,
    })
      .then((payload) => {
        if (!active) return;
        setOrders(payload.items || []);
      })
      .catch(() => {
        if (!active) return;
        setFailed(true);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [filter, status]);

  return (
    <>
      <PageHero
        eyebrow="P2P"
        title="My P2P orders"
        description="Track order states, payment confirmations, escrow release, and dispute progress."
        badge="Private page"
      />
      <ContentSection>
        <ProtectedRoute>
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <Link href="/p2p">
              <Button variant="secondary">Back to marketplace</Button>
            </Link>
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value as "" | P2POrder["status"])}
              className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"
            >
              <option value="">All statuses</option>
              <option value="PENDING_PAYMENT">Pending payment</option>
              <option value="PAID">Paid</option>
              <option value="RELEASED">Released</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="DISPUTED">Disputed</option>
              <option value="EXPIRED">Expired</option>
            </select>
          </div>

          {loading ? (
            <Card>
              <p className="text-lg font-semibold text-white">Loading orders...</p>
            </Card>
          ) : failed ? (
            <Card>
              <p className="text-lg font-semibold text-white">Unable to load orders</p>
              <p className="mt-2 text-sm text-muted">Please refresh or try again later.</p>
            </Card>
          ) : !orders.length ? (
            <Card>
              <p className="text-lg font-semibold text-white">No orders found</p>
              <p className="mt-2 text-sm text-muted">You do not have any orders for this filter yet.</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => (
                <Card key={order.id}>
                  <div className="grid gap-3 md:grid-cols-6">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted">Role</p>
                      <p className="text-sm font-medium text-white">{order.role.toUpperCase()}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted">Counterparty</p>
                      <p className="text-sm font-medium text-white">{order.counterparty.nickname}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted">Amount</p>
                      <p className="text-sm font-medium text-white">
                        {formatNumber(order.cryptoAmount, 8)} {order.assetCode}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted">Fiat</p>
                      <p className="text-sm font-medium text-white">
                        {formatNumber(order.fiatAmount, 2)} {order.fiatCurrency}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted">Status</p>
                      <p className="text-sm font-medium text-white">{order.status}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted">Expires</p>
                      <p className="text-sm font-medium text-white">{formatDateTime(order.expiresAt)}</p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <Link href={`/p2p/orders/${order.id}`}>
                      <Button>Open order</Button>
                    </Link>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </ProtectedRoute>
      </ContentSection>
    </>
  );
}
