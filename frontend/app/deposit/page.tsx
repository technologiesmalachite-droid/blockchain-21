"use client";

import { Copy } from "lucide-react";
import { useState } from "react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ContentSection, PageHero } from "@/components/PageShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { createDepositRequest, requestDepositAddress } from "@/lib/api/private-data";
import { useDemo } from "@/lib/demo-provider";

export default function DepositPage() {
  const { submitToast } = useDemo();
  const [asset, setAsset] = useState("USDT");
  const [network, setNetwork] = useState("TRC20");
  const [walletType, setWalletType] = useState<"spot" | "funding">("funding");
  const [amount, setAmount] = useState("1500");
  const [address, setAddress] = useState("");
  const [memo, setMemo] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  const generateAddress = async () => {
    setBusy(true);

    try {
      const response = await requestDepositAddress({ asset, network, walletType });
      setAddress(response.address);
      setMemo(response.memo);
      submitToast("Deposit address ready", "Use this address for incoming funds on the selected network.");
    } catch {
      submitToast("Address unavailable", "Unable to generate a deposit address right now.");
    } finally {
      setBusy(false);
    }
  };

  const submitDepositRequest = async () => {
    const parsedAmount = Number(amount);

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      submitToast("Invalid amount", "Enter a valid deposit amount before continuing.");
      return;
    }

    if (!address) {
      submitToast("Generate address first", "Create a deposit address before creating a deposit request.");
      return;
    }

    setBusy(true);

    try {
      await createDepositRequest({ asset, network, amount: parsedAmount, walletType, address });
      submitToast("Deposit intent created", "Your deposit is now tracked in wallet activity.");
    } catch {
      submitToast("Request unavailable", "We couldn't create your deposit request. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHero
        eyebrow="Deposit"
        title="Create a secure deposit intent"
        description="Select asset and network, generate a custody-backed address, and track incoming funds in wallet history."
        badge="Private page"
      />
      <ContentSection>
        <ProtectedRoute>
          <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
            <Card>
              <div className="grid gap-4 md:grid-cols-2">
                <select value={asset} onChange={(event) => setAsset(event.target.value)} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white">
                  <option>USDT</option>
                  <option>BTC</option>
                  <option>ETH</option>
                </select>
                <select value={network} onChange={(event) => setNetwork(event.target.value)} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white">
                  <option>TRC20</option>
                  <option>ERC20</option>
                  <option>BEP20</option>
                </select>
                <select value={walletType} onChange={(event) => setWalletType(event.target.value as "spot" | "funding")} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white">
                  <option value="funding">Funding wallet</option>
                  <option value="spot">Spot wallet</option>
                </select>
                <input value={amount} onChange={(event) => setAmount(event.target.value)} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white" />
              </div>

              <div className="mt-6 rounded-3xl border border-white/10 bg-black/20 p-6">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-muted">Deposit address</p>
                  <Button variant="secondary" onClick={generateAddress} disabled={busy}>
                    {busy ? "Generating..." : "Generate address"}
                  </Button>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                  <span className="truncate text-sm text-white">{address || "Generate a new address to continue"}</span>
                  <button
                    type="button"
                    disabled={!address}
                    onClick={() => {
                      if (!address) {
                        return;
                      }
                      navigator.clipboard.writeText(address);
                      submitToast("Address copied", "Deposit address copied to clipboard.");
                    }}
                    className="text-muted hover:text-white disabled:opacity-40"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
                {memo ? <p className="mt-2 text-xs text-muted">Memo/Tag: {memo}</p> : null}
                <div className="mt-6 flex h-40 items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/5 text-sm text-muted">QR code placeholder</div>
              </div>
            </Card>
            <Card>
              <p className="text-lg font-semibold text-white">Deposit controls</p>
              <div className="mt-4 space-y-3 text-sm text-muted">
                <p>Use only the selected network and asset pair.</p>
                <p>Deposits are credited after network confirmations and compliance checks.</p>
                <p>Deposit intents improve reconciliation and AML transaction monitoring.</p>
              </div>
              <Button className="mt-6 w-full" onClick={submitDepositRequest} disabled={busy}>
                {busy ? "Submitting..." : "Create deposit intent"}
              </Button>
            </Card>
          </div>
        </ProtectedRoute>
      </ContentSection>
    </>
  );
}
