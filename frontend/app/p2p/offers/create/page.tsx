"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ContentSection, PageHero } from "@/components/PageShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { createP2pOffer, fetchP2pConfig, fetchP2pPaymentMethods, type P2PPaymentMethod } from "@/lib/api/private-data";
import { useAuth } from "@/lib/auth-provider";
import { useDemo } from "@/lib/demo-provider";

type OfferForm = {
  tradeType: "buy" | "sell";
  assetCode: string;
  fiatCurrency: string;
  walletType: "spot" | "funding";
  price: string;
  totalQuantity: string;
  minAmount: string;
  maxAmount: string;
  terms: string;
  autoCancelMinutes: string;
  paymentMethodIds: string[];
};

const initialForm: OfferForm = {
  tradeType: "sell",
  assetCode: "USDT",
  fiatCurrency: "INR",
  walletType: "funding",
  price: "",
  totalQuantity: "",
  minAmount: "",
  maxAmount: "",
  terms: "",
  autoCancelMinutes: "15",
  paymentMethodIds: [],
};

export default function CreateP2POfferPage() {
  const { status } = useAuth();
  const { submitToast } = useDemo();
  const [form, setForm] = useState<OfferForm>(initialForm);
  const [methods, setMethods] = useState<P2PPaymentMethod[]>([]);
  const [assets, setAssets] = useState<string[]>(["USDT"]);
  const [fiats, setFiats] = useState<string[]>(["INR"]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;

    if (status !== "authenticated") {
      setMethods([]);
      return () => {
        active = false;
      };
    }

    Promise.all([fetchP2pConfig(), fetchP2pPaymentMethods()])
      .then(([configPayload, methodsPayload]) => {
        if (!active) {
          return;
        }

        const configAssets = configPayload.config.assets || ["USDT"];
        const configFiats = configPayload.config.fiatCurrencies || ["INR"];
        setAssets(configAssets);
        setFiats(configFiats);
        setMethods(methodsPayload.items?.filter((item) => item.isActive) || []);

        setForm((current) => ({
          ...current,
          assetCode: current.assetCode || configAssets[0] || "USDT",
          fiatCurrency: current.fiatCurrency || configFiats[0] || "INR",
        }));
      })
      .catch((error) => {
        submitToast("Unable to load", error instanceof Error ? error.message : "Could not load P2P setup data.");
      });

    return () => {
      active = false;
    };
  }, [status, submitToast]);

  const togglePaymentMethod = (id: string) => {
    setForm((current) => ({
      ...current,
      paymentMethodIds: current.paymentMethodIds.includes(id)
        ? current.paymentMethodIds.filter((item) => item !== id)
        : [...current.paymentMethodIds, id],
    }));
  };

  const submit = async () => {
    const price = Number(form.price);
    const totalQuantity = Number(form.totalQuantity);
    const minAmount = Number(form.minAmount);
    const maxAmount = Number(form.maxAmount);
    const autoCancelMinutes = Number(form.autoCancelMinutes);

    if (!Number.isFinite(price) || price <= 0) {
      submitToast("Invalid price", "Price must be greater than zero.");
      return;
    }

    if (!Number.isFinite(totalQuantity) || totalQuantity <= 0) {
      submitToast("Invalid quantity", "Total quantity must be greater than zero.");
      return;
    }

    if (!Number.isFinite(minAmount) || !Number.isFinite(maxAmount) || minAmount <= 0 || maxAmount < minAmount) {
      submitToast("Invalid limits", "Order limits must be valid and max must be greater than or equal to min.");
      return;
    }

    if (!form.paymentMethodIds.length) {
      submitToast("Payment method required", "Select at least one payment method.");
      return;
    }

    setSaving(true);
    try {
      await createP2pOffer({
        tradeType: form.tradeType,
        assetCode: form.assetCode,
        fiatCurrency: form.fiatCurrency,
        walletType: form.walletType,
        pricingType: "fixed",
        price,
        totalQuantity,
        minAmount,
        maxAmount,
        paymentMethodIds: form.paymentMethodIds,
        terms: form.terms || undefined,
        autoCancelMinutes: Number.isFinite(autoCancelMinutes) ? autoCancelMinutes : 15,
      });

      submitToast("Offer created", "Your P2P offer is now live in the marketplace.");
      setForm(initialForm);
    } catch (error) {
      submitToast("Create failed", error instanceof Error ? error.message : "Unable to create offer.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHero
        eyebrow="P2P"
        title="Create offer"
        description="Publish a buy or sell offer with fixed price, limits, and selected payment methods."
        badge="Private page"
      />
      <ContentSection>
        <ProtectedRoute>
          <div className="mb-6 flex flex-wrap gap-3">
            <Link href="/p2p">
              <Button variant="secondary">Back to marketplace</Button>
            </Link>
            <Link href="/p2p/payment-methods">
              <Button variant="secondary">Manage payment methods</Button>
            </Link>
          </div>
          <Card>
            <div className="grid gap-4 md:grid-cols-2">
              <select
                value={form.tradeType}
                onChange={(event) => setForm((current) => ({ ...current, tradeType: event.target.value as "buy" | "sell" }))}
                className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"
              >
                <option value="sell">Sell crypto</option>
                <option value="buy">Buy crypto</option>
              </select>
              <select
                value={form.walletType}
                onChange={(event) => setForm((current) => ({ ...current, walletType: event.target.value as "spot" | "funding" }))}
                className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"
              >
                <option value="funding">Funding wallet</option>
                <option value="spot">Spot wallet</option>
              </select>
              <select
                value={form.assetCode}
                onChange={(event) => setForm((current) => ({ ...current, assetCode: event.target.value }))}
                className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"
              >
                {assets.map((asset) => (
                  <option key={asset} value={asset}>
                    {asset}
                  </option>
                ))}
              </select>
              <select
                value={form.fiatCurrency}
                onChange={(event) => setForm((current) => ({ ...current, fiatCurrency: event.target.value }))}
                className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"
              >
                {fiats.map((fiat) => (
                  <option key={fiat} value={fiat}>
                    {fiat}
                  </option>
                ))}
              </select>
              <input
                value={form.price}
                onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))}
                className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"
                placeholder="Price"
              />
              <input
                value={form.totalQuantity}
                onChange={(event) => setForm((current) => ({ ...current, totalQuantity: event.target.value }))}
                className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"
                placeholder="Total quantity"
              />
              <input
                value={form.minAmount}
                onChange={(event) => setForm((current) => ({ ...current, minAmount: event.target.value }))}
                className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"
                placeholder="Minimum order amount"
              />
              <input
                value={form.maxAmount}
                onChange={(event) => setForm((current) => ({ ...current, maxAmount: event.target.value }))}
                className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"
                placeholder="Maximum order amount"
              />
              <input
                value={form.autoCancelMinutes}
                onChange={(event) => setForm((current) => ({ ...current, autoCancelMinutes: event.target.value }))}
                className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"
                placeholder="Auto-cancel minutes"
              />
            </div>
            <textarea
              value={form.terms}
              onChange={(event) => setForm((current) => ({ ...current, terms: event.target.value }))}
              className="mt-4 min-h-24 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"
              placeholder="Trade terms / instructions"
            />

            <div className="mt-4">
              <p className="text-sm font-medium text-white">Select payment methods</p>
              {!methods.length ? (
                <p className="mt-2 text-sm text-muted">No active payment methods. Add one first to create an offer.</p>
              ) : (
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {methods.map((method) => (
                    <label key={method.id} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white">
                      <input
                        type="checkbox"
                        checked={form.paymentMethodIds.includes(method.id)}
                        onChange={() => togglePaymentMethod(method.id)}
                        className="h-4 w-4"
                      />
                      <span>{method.label}</span>
                      <span className="text-xs text-muted">{method.methodType.toUpperCase()}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-5">
              <Button onClick={submit} disabled={saving || !methods.length}>
                {saving ? "Creating..." : "Create offer"}
              </Button>
            </div>
          </Card>
        </ProtectedRoute>
      </ContentSection>
    </>
  );
}
