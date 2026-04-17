"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ContentSection, PageHero } from "@/components/PageShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  createP2pOrder,
  fetchP2pConfig,
  fetchP2pMarketplaceOffers,
  type P2POffer,
  type P2PPaymentMethod,
  fetchP2pPaymentMethods,
} from "@/lib/api/private-data";
import { useAuth } from "@/lib/auth-provider";
import { useDemo } from "@/lib/demo-provider";
import { formatNumber } from "@/lib/utils";

type MarketplaceState = {
  loading: boolean;
  failed: boolean;
  errorMessage: string;
  offers: P2POffer[];
  page: number;
  totalPages: number;
};

const initialMarketplaceState: MarketplaceState = {
  loading: false,
  failed: false,
  errorMessage: "",
  offers: [],
  page: 1,
  totalPages: 1,
};

const deriveErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  return fallback;
};

export default function P2PPage() {
  const { status } = useAuth();
  const { submitToast } = useDemo();
  const [filters, setFilters] = useState<{
    side: "buy" | "sell";
    assetCode: string;
    fiatCurrency: string;
    paymentMethodType: "" | "bank_transfer" | "upi" | "manual";
  }>({
    side: "buy",
    assetCode: "USDT",
    fiatCurrency: "INR",
    paymentMethodType: "",
  });
  const [config, setConfig] = useState<{
    assets: string[];
    fiatCurrencies: string[];
    paymentMethodTypes: string[];
  }>({
    assets: [],
    fiatCurrencies: [],
    paymentMethodTypes: [],
  });
  const [paymentMethods, setPaymentMethods] = useState<P2PPaymentMethod[]>([]);
  const [state, setState] = useState<MarketplaceState>(initialMarketplaceState);
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);
  const [orderForm, setOrderForm] = useState({
    fiatAmount: "",
    paymentMethodId: "",
  });
  const [orderSubmitting, setOrderSubmitting] = useState(false);

  const loadMarketplace = useCallback(
    async (page = 1) => {
      setState((current) => ({
        ...current,
        loading: true,
        failed: false,
        errorMessage: "",
      }));

      try {
        const payload = await fetchP2pMarketplaceOffers({
          side: filters.side,
          assetCode: filters.assetCode || undefined,
          fiatCurrency: filters.fiatCurrency || undefined,
          paymentMethodType: filters.paymentMethodType || undefined,
          page,
          pageSize: 20,
        });

        setState({
          loading: false,
          failed: false,
          errorMessage: "",
          offers: payload.items,
          page: payload.pagination.page,
          totalPages: payload.pagination.totalPages,
        });
      } catch (error) {
        setState({
          ...initialMarketplaceState,
          failed: true,
          errorMessage: deriveErrorMessage(error, "Unable to load P2P marketplace right now."),
        });
      }
    },
    [filters.assetCode, filters.fiatCurrency, filters.paymentMethodType, filters.side],
  );

  useEffect(() => {
    let active = true;

    if (status !== "authenticated") {
      setState(initialMarketplaceState);
      setConfig({
        assets: [],
        fiatCurrencies: [],
        paymentMethodTypes: [],
      });
      setPaymentMethods([]);
      return () => {
        active = false;
      };
    }

    Promise.all([fetchP2pConfig(), fetchP2pPaymentMethods(), fetchP2pMarketplaceOffers({ side: filters.side, page: 1, pageSize: 20 })])
      .then(([configPayload, paymentMethodsPayload, offersPayload]) => {
        if (!active) {
          return;
        }

        const assets = configPayload.config.assets || [];
        const fiatCurrencies = configPayload.config.fiatCurrencies || [];
        const paymentMethodTypes = configPayload.config.paymentMethodTypes || [];

        setConfig({
          assets,
          fiatCurrencies,
          paymentMethodTypes,
        });

        setFilters((current) => ({
          ...current,
          assetCode: current.assetCode || assets[0] || "USDT",
          fiatCurrency: current.fiatCurrency || fiatCurrencies[0] || "INR",
        }));

        setPaymentMethods(paymentMethodsPayload.items || []);
        setState({
          loading: false,
          failed: false,
          errorMessage: "",
          offers: offersPayload.items || [],
          page: offersPayload.pagination.page,
          totalPages: offersPayload.pagination.totalPages,
        });
      })
      .catch((error) => {
        if (!active) {
          return;
        }

        setState({
          ...initialMarketplaceState,
          failed: true,
          errorMessage: deriveErrorMessage(error, "Unable to initialize P2P marketplace."),
        });
      });

    return () => {
      active = false;
    };
  }, [filters.side, status]);

  const selectedOffer = useMemo(
    () => state.offers.find((item) => item.id === selectedOfferId) || null,
    [selectedOfferId, state.offers],
  );

  const submitOrder = async () => {
    if (!selectedOfferId) {
      return;
    }

    const amount = Number(orderForm.fiatAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      submitToast("Invalid amount", "Enter a valid fiat amount to continue.");
      return;
    }

    setOrderSubmitting(true);
    try {
      await createP2pOrder(selectedOfferId, {
        fiatAmount: amount,
        paymentMethodId: orderForm.paymentMethodId || undefined,
      });
      submitToast("Order created", "P2P order created successfully. Continue in the order page.");
      setSelectedOfferId(null);
      setOrderForm({
        fiatAmount: "",
        paymentMethodId: "",
      });
      await loadMarketplace(state.page);
    } catch (error) {
      submitToast("Order failed", deriveErrorMessage(error, "Unable to create P2P order."));
    } finally {
      setOrderSubmitting(false);
    }
  };

  return (
    <>
      <PageHero
        eyebrow="P2P"
        title="Peer-to-peer trading marketplace"
        description="Browse verified advertiser offers, choose payment methods, and complete escrow-protected P2P orders."
        badge="Private page"
      />
      <ContentSection>
        <ProtectedRoute>
          <div className="grid gap-6 lg:grid-cols-[1fr_auto]">
            <Card>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant={filters.side === "buy" ? "primary" : "secondary"}
                  onClick={() => setFilters((current) => ({ ...current, side: "buy" }))}
                >
                  Buy crypto
                </Button>
                <Button
                  variant={filters.side === "sell" ? "primary" : "secondary"}
                  onClick={() => setFilters((current) => ({ ...current, side: "sell" }))}
                >
                  Sell crypto
                </Button>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <select
                  value={filters.assetCode}
                  onChange={(event) => setFilters((current) => ({ ...current, assetCode: event.target.value }))}
                  className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"
                >
                  {(config.assets.length ? config.assets : ["USDT"]).map((asset) => (
                    <option key={asset} value={asset}>
                      {asset}
                    </option>
                  ))}
                </select>
                <select
                  value={filters.fiatCurrency}
                  onChange={(event) => setFilters((current) => ({ ...current, fiatCurrency: event.target.value }))}
                  className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"
                >
                  {(config.fiatCurrencies.length ? config.fiatCurrencies : ["INR"]).map((fiat) => (
                    <option key={fiat} value={fiat}>
                      {fiat}
                    </option>
                  ))}
                </select>
                <select
                  value={filters.paymentMethodType}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      paymentMethodType: event.target.value as "" | "bank_transfer" | "upi" | "manual",
                    }))
                  }
                  className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"
                >
                  <option value="">All payment methods</option>
                  <option value="bank_transfer">Bank transfer</option>
                  <option value="upi">UPI</option>
                  <option value="manual">Manual</option>
                </select>
              </div>
              <div className="mt-4">
                <Button variant="secondary" onClick={() => loadMarketplace(1)} disabled={state.loading}>
                  {state.loading ? "Loading..." : "Refresh offers"}
                </Button>
              </div>
            </Card>
            <div className="flex flex-wrap gap-3 lg:flex-col">
              <Link href="/p2p/payment-methods">
                <Button variant="secondary">Payment methods</Button>
              </Link>
              <Link href="/p2p/offers/create">
                <Button>Create offer</Button>
              </Link>
              <Link href="/p2p/orders">
                <Button variant="secondary">My orders</Button>
              </Link>
            </div>
          </div>

          <div className="mt-6">
            {state.failed ? (
              <Card className="border-white/15 bg-black/25">
                <p className="text-xl font-semibold text-white">Unable to load P2P offers</p>
                <p className="mt-2 text-sm text-muted">{state.errorMessage}</p>
              </Card>
            ) : !state.offers.length ? (
              <Card className="border-white/15 bg-black/25">
                <p className="text-xl font-semibold text-white">No offers available</p>
                <p className="mt-2 text-sm text-muted">Try changing filters or create a new offer.</p>
              </Card>
            ) : (
              <div className="space-y-4">
                {state.offers.map((offer) => (
                  <Card key={offer.id}>
                    <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr_0.8fr_auto]">
                      <div>
                        <p className="text-base font-semibold text-white">{offer.advertiser.nickname}</p>
                        <p className="mt-1 text-xs text-muted">
                          Completion {offer.advertiser.completionRate != null ? `${offer.advertiser.completionRate}%` : "N/A"}
                          {" · "}
                          {offer.advertiser.totalTrades} trades
                        </p>
                        <p className="mt-3 text-sm text-muted">
                          {offer.assetCode}/{offer.fiatCurrency} · {offer.priceType.toUpperCase()}
                        </p>
                        <p className="mt-1 text-xl font-semibold text-white">
                          {formatNumber(offer.price, 4)} {offer.fiatCurrency}
                        </p>
                      </div>
                      <div className="text-sm text-muted">
                        <p>Available: {formatNumber(offer.remainingQuantity, 8)} {offer.assetCode}</p>
                        <p className="mt-1">
                          Limits: {formatNumber(offer.minAmount, 2)} - {formatNumber(offer.maxAmount, 2)} {offer.fiatCurrency}
                        </p>
                        <p className="mt-1">Auto-cancel: {offer.autoCancelMinutes} min</p>
                        <p className="mt-2">
                          Payment:{" "}
                          {offer.paymentMethods.length
                            ? offer.paymentMethods.map((method) => method.label).join(", ")
                            : "None"}
                        </p>
                      </div>
                      <div className="text-sm text-muted">
                        <p>Offer type: {offer.tradeType.toUpperCase()}</p>
                        <p className="mt-1">Status: {offer.status}</p>
                        {offer.terms ? <p className="mt-2 line-clamp-3">{offer.terms}</p> : null}
                      </div>
                      <div className="flex items-start">
                        <Button onClick={() => setSelectedOfferId((current) => (current === offer.id ? null : offer.id))}>
                          {offer.takerSide === "buy" ? "Buy" : "Sell"}
                        </Button>
                      </div>
                    </div>

                    {selectedOfferId === offer.id ? (
                      <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                        <p className="text-sm font-medium text-white">Create order</p>
                        <div className="mt-3 grid gap-3 md:grid-cols-3">
                          <input
                            value={orderForm.fiatAmount}
                            onChange={(event) => setOrderForm((current) => ({ ...current, fiatAmount: event.target.value }))}
                            className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"
                            placeholder={`Amount in ${offer.fiatCurrency}`}
                          />
                          <select
                            value={orderForm.paymentMethodId}
                            onChange={(event) => setOrderForm((current) => ({ ...current, paymentMethodId: event.target.value }))}
                            className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"
                          >
                            <option value="">Default payment method</option>
                            {offer.paymentMethods.map((method) => (
                              <option key={method.id} value={method.id}>
                                {method.label}
                              </option>
                            ))}
                          </select>
                          <div className="flex gap-2">
                            <Button onClick={submitOrder} disabled={orderSubmitting}>
                              {orderSubmitting ? "Submitting..." : "Place order"}
                            </Button>
                            <Button variant="secondary" onClick={() => setSelectedOfferId(null)} disabled={orderSubmitting}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                        {selectedOffer ? (
                          <p className="mt-3 text-xs text-muted">
                            Your amount must be between {formatNumber(selectedOffer.minAmount, 2)} and{" "}
                            {formatNumber(selectedOffer.maxAmount, 2)} {selectedOffer.fiatCurrency}.
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </Card>
                ))}
              </div>
            )}
          </div>

          {state.totalPages > 1 ? (
            <div className="mt-6 flex items-center justify-between text-sm text-muted">
              <p>
                Page {state.page} of {state.totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  disabled={state.page <= 1 || state.loading}
                  onClick={() => loadMarketplace(state.page - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  disabled={state.page >= state.totalPages || state.loading}
                  onClick={() => loadMarketplace(state.page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}

          {paymentMethods.length === 0 ? (
            <Card className="mt-6 border-white/15 bg-black/25">
              <p className="text-base font-semibold text-white">Add your payment method</p>
              <p className="mt-2 text-sm text-muted">
                Add at least one payment method to create P2P offers and complete order settlements.
              </p>
              <div className="mt-3">
                <Link href="/p2p/payment-methods">
                  <Button>Add payment method</Button>
                </Link>
              </div>
            </Card>
          ) : null}
        </ProtectedRoute>
      </ContentSection>
    </>
  );
}
