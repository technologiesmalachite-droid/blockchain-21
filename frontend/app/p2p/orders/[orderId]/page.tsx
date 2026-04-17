"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ContentSection, PageHero } from "@/components/PageShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  cancelP2pOrder,
  fetchP2pOrder,
  markP2pOrderPaid,
  openP2pDispute,
  releaseP2pOrder,
  sendP2pOrderMessage,
  type P2POrder,
} from "@/lib/api/private-data";
import { useAuth } from "@/lib/auth-provider";
import { useDemo } from "@/lib/demo-provider";
import { formatNumber } from "@/lib/utils";

const formatDateTime = (value?: string | null) => {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleString();
};

export default function P2POrderDetailPage() {
  const { status } = useAuth();
  const { submitToast } = useDemo();
  const params = useParams<{ orderId: string }>();
  const orderId = String(params?.orderId || "");
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState<P2POrder | null>(null);
  const [messageText, setMessageText] = useState("");
  const [busy, setBusy] = useState(false);

  const loadOrder = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    try {
      const payload = await fetchP2pOrder(orderId);
      setOrder(payload.order);
    } catch (error) {
      submitToast("Unable to load", error instanceof Error ? error.message : "Could not load order.");
    } finally {
      setLoading(false);
    }
  }, [orderId, submitToast]);

  useEffect(() => {
    if (status !== "authenticated") {
      setOrder(null);
      return;
    }

    loadOrder().catch(() => undefined);
  }, [loadOrder, status]);

  const canMarkPaid = useMemo(() => order?.role === "buyer" && order?.status === "PENDING_PAYMENT", [order]);
  const canRelease = useMemo(() => order?.role === "seller" && order?.status === "PAID", [order]);
  const canCancel = useMemo(() => order?.status === "PENDING_PAYMENT", [order]);
  const canDispute = useMemo(
    () => order && ["PENDING_PAYMENT", "PAID", "RELEASED"].includes(order.status) && !order.dispute,
    [order],
  );

  const runOrderAction = async (action: "paid" | "release" | "cancel" | "dispute") => {
    if (!orderId) return;

    setBusy(true);
    try {
      if (action === "paid") {
        await markP2pOrderPaid(orderId);
        submitToast("Payment marked", "Seller has been notified that payment is completed.");
      } else if (action === "release") {
        await releaseP2pOrder(orderId);
        submitToast("Escrow released", "Crypto has been credited to the buyer wallet.");
      } else if (action === "cancel") {
        await cancelP2pOrder(orderId);
        submitToast("Order cancelled", "Escrow has been unlocked.");
      } else {
        const reason = window.prompt("Enter dispute reason");
        if (!reason) {
          return;
        }
        await openP2pDispute(orderId, reason);
        submitToast("Dispute opened", "Order is now in disputed status.");
      }

      await loadOrder();
    } catch (error) {
      submitToast("Action failed", error instanceof Error ? error.message : "Could not update order.");
    } finally {
      setBusy(false);
    }
  };

  const sendMessage = async () => {
    if (!orderId || !messageText.trim()) {
      return;
    }

    setBusy(true);
    try {
      await sendP2pOrderMessage(orderId, messageText.trim());
      setMessageText("");
      await loadOrder();
    } catch (error) {
      submitToast("Message failed", error instanceof Error ? error.message : "Could not send message.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHero
        eyebrow="P2P"
        title="Order details"
        description="Track order progress, settlement state, and conversation with your counterparty."
        badge="Private page"
      />
      <ContentSection>
        <ProtectedRoute>
          <div className="mb-6 flex flex-wrap gap-3">
            <Link href="/p2p/orders">
              <Button variant="secondary">Back to orders</Button>
            </Link>
            <Link href="/p2p">
              <Button variant="secondary">Marketplace</Button>
            </Link>
          </div>

          {loading || !order ? (
            <Card>
              <p className="text-lg font-semibold text-white">{loading ? "Loading order..." : "Order unavailable"}</p>
            </Card>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
              <Card>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted">Status</p>
                    <p className="text-sm font-medium text-white">{order.status}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted">Role</p>
                    <p className="text-sm font-medium text-white">{order.role.toUpperCase()}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted">Counterparty</p>
                    <p className="text-sm font-medium text-white">{order.counterparty.nickname}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted">Price</p>
                    <p className="text-sm font-medium text-white">
                      {formatNumber(order.unitPrice, 4)} {order.fiatCurrency}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted">Crypto amount</p>
                    <p className="text-sm font-medium text-white">
                      {formatNumber(order.cryptoAmount, 8)} {order.assetCode}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted">Fiat amount</p>
                    <p className="text-sm font-medium text-white">
                      {formatNumber(order.fiatAmount, 2)} {order.fiatCurrency}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted">Expires at</p>
                    <p className="text-sm font-medium text-white">{formatDateTime(order.expiresAt)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted">Payment method</p>
                    <p className="text-sm font-medium text-white">{order.paymentMethod?.label || "N/A"}</p>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  {canMarkPaid ? (
                    <Button onClick={() => runOrderAction("paid")} disabled={busy}>
                      I have paid
                    </Button>
                  ) : null}
                  {canRelease ? (
                    <Button onClick={() => runOrderAction("release")} disabled={busy}>
                      Release crypto
                    </Button>
                  ) : null}
                  {canCancel ? (
                    <Button variant="secondary" onClick={() => runOrderAction("cancel")} disabled={busy}>
                      Cancel order
                    </Button>
                  ) : null}
                  {canDispute ? (
                    <Button variant="secondary" onClick={() => runOrderAction("dispute")} disabled={busy}>
                      Open dispute
                    </Button>
                  ) : null}
                </div>

                {order.offerTerms ? (
                  <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-muted">
                    <p className="font-medium text-white">Offer instructions</p>
                    <p className="mt-2 whitespace-pre-wrap">{order.offerTerms}</p>
                  </div>
                ) : null}
              </Card>

              <Card>
                <p className="text-lg font-semibold text-white">Order chat</p>
                <div className="mt-4 max-h-[420px] space-y-3 overflow-y-auto pr-1">
                  {(order.messages || []).length ? (
                    (order.messages || []).map((message) => (
                      <div key={message.id} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm">
                        <p className="text-xs uppercase tracking-wide text-muted">
                          {message.messageType === "SYSTEM"
                            ? "SYSTEM"
                            : message.senderNickname || "User"}
                        </p>
                        <p className="mt-1 text-white">{message.body}</p>
                        <p className="mt-1 text-xs text-muted">{formatDateTime(message.createdAt)}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted">No messages yet.</p>
                  )}
                </div>

                <div className="mt-4 grid gap-2">
                  <textarea
                    value={messageText}
                    onChange={(event) => setMessageText(event.target.value)}
                    className="min-h-24 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"
                    placeholder="Type your message to counterparty"
                  />
                  <Button onClick={sendMessage} disabled={busy || !messageText.trim()}>
                    Send message
                  </Button>
                </div>
              </Card>
            </div>
          )}
        </ProtectedRoute>
      </ContentSection>
    </>
  );
}
