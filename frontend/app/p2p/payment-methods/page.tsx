"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ContentSection, PageHero } from "@/components/PageShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  createP2pPaymentMethod,
  deleteP2pPaymentMethod,
  fetchP2pPaymentMethods,
  type P2PPaymentMethod,
  updateP2pPaymentMethod,
} from "@/lib/api/private-data";
import { useAuth } from "@/lib/auth-provider";
import { useDemo } from "@/lib/demo-provider";

const emptyForm = {
  methodType: "bank_transfer" as "bank_transfer" | "upi" | "manual",
  label: "",
  accountName: "",
  accountNumber: "",
  upiId: "",
};

export default function P2PPaymentMethodsPage() {
  const { status } = useAuth();
  const { submitToast } = useDemo();
  const [methods, setMethods] = useState<P2PPaymentMethod[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const loadMethods = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await fetchP2pPaymentMethods(true);
      setMethods(payload.items || []);
    } catch (error) {
      submitToast("Unable to load", error instanceof Error ? error.message : "Could not load payment methods.");
    } finally {
      setLoading(false);
    }
  }, [submitToast]);

  useEffect(() => {
    if (status !== "authenticated") {
      setMethods([]);
      return;
    }
    loadMethods().catch(() => undefined);
  }, [loadMethods, status]);

  const createMethod = async () => {
    setSaving(true);
    try {
      await createP2pPaymentMethod({
        methodType: form.methodType,
        label: form.label,
        accountName: form.accountName,
        accountNumber: form.accountNumber || undefined,
        upiId: form.upiId || undefined,
      });

      setForm(emptyForm);
      submitToast("Payment method added", "Your payment method is now available for P2P offers.");
      await loadMethods();
    } catch (error) {
      submitToast("Unable to save", error instanceof Error ? error.message : "Could not save payment method.");
    } finally {
      setSaving(false);
    }
  };

  const toggleMethod = async (method: P2PPaymentMethod) => {
    try {
      await updateP2pPaymentMethod(method.id, { isActive: !method.isActive });
      await loadMethods();
    } catch (error) {
      submitToast("Update failed", error instanceof Error ? error.message : "Could not update payment method.");
    }
  };

  const removeMethod = async (methodId: string) => {
    try {
      await deleteP2pPaymentMethod(methodId);
      submitToast("Payment method removed", "The payment method has been deactivated.");
      await loadMethods();
    } catch (error) {
      submitToast("Delete failed", error instanceof Error ? error.message : "Could not remove payment method.");
    }
  };

  return (
    <>
      <PageHero
        eyebrow="P2P"
        title="Payment methods"
        description="Manage your masked settlement methods used for P2P offers and order matching."
        badge="Private page"
      />
      <ContentSection>
        <ProtectedRoute>
          <div className="mb-6 flex flex-wrap gap-3">
            <Link href="/p2p">
              <Button variant="secondary">Back to marketplace</Button>
            </Link>
            <Link href="/p2p/offers/create">
              <Button>Create offer</Button>
            </Link>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
            <Card>
              <p className="text-lg font-semibold text-white">Add payment method</p>
              <div className="mt-4 grid gap-3">
                <select
                  value={form.methodType}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      methodType: event.target.value as "bank_transfer" | "upi" | "manual",
                    }))
                  }
                  className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"
                >
                  <option value="bank_transfer">Bank transfer</option>
                  <option value="upi">UPI</option>
                  <option value="manual">Manual</option>
                </select>
                <input
                  value={form.label}
                  onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))}
                  className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"
                  placeholder="Label (e.g. HDFC Account)"
                />
                <input
                  value={form.accountName}
                  onChange={(event) => setForm((current) => ({ ...current, accountName: event.target.value }))}
                  className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"
                  placeholder="Account holder name"
                />
                {form.methodType === "bank_transfer" ? (
                  <input
                    value={form.accountNumber}
                    onChange={(event) => setForm((current) => ({ ...current, accountNumber: event.target.value }))}
                    className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"
                    placeholder="Account number"
                  />
                ) : null}
                {form.methodType === "upi" ? (
                  <input
                    value={form.upiId}
                    onChange={(event) => setForm((current) => ({ ...current, upiId: event.target.value }))}
                    className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"
                    placeholder="UPI ID"
                  />
                ) : null}
              </div>
              <div className="mt-4">
                <Button onClick={createMethod} disabled={saving}>
                  {saving ? "Saving..." : "Save payment method"}
                </Button>
              </div>
            </Card>

            <Card>
              <p className="text-lg font-semibold text-white">Your payment methods</p>
              {loading ? (
                <p className="mt-4 text-sm text-muted">Loading methods...</p>
              ) : !methods.length ? (
                <p className="mt-4 text-sm text-muted">No payment methods added yet.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {methods.map((method) => (
                    <div key={method.id} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm">
                      <p className="font-semibold text-white">{method.label}</p>
                      <p className="mt-1 text-muted">
                        {method.methodType.toUpperCase()} · {method.accountName}
                      </p>
                      <p className="mt-1 text-muted">
                        {method.accountNumberMasked || method.upiIdMasked || "Masked details available"}
                      </p>
                      <p className="mt-1 text-xs text-muted">Status: {method.isActive ? "ACTIVE" : "INACTIVE"}</p>
                      <div className="mt-3 flex gap-2">
                        <Button variant="secondary" onClick={() => toggleMethod(method)}>
                          {method.isActive ? "Disable" : "Enable"}
                        </Button>
                        <Button variant="secondary" onClick={() => removeMethod(method.id)}>
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </ProtectedRoute>
      </ContentSection>
    </>
  );
}
