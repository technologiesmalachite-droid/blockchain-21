"use client";

import { Copy } from "lucide-react";
import { useMemo, useState } from "react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ContentSection, PageHero } from "@/components/PageShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { createDepositRequest, requestDepositAddress, type WalletDepositAddress } from "@/lib/api/private-data";
import { useDemo } from "@/lib/demo-provider";

const assetNetworks: Record<string, string[]> = {
  BTC: ["BTC"],
  ETH: ["ERC20"],
  BNB: ["BEP20"],
  BCH: ["BCH"],
  LTC: ["LTC"],
  SOL: ["SOL"],
  TON: ["TON"],
  TRON: ["TRON"],
  USDC: ["ERC20", "SOL", "TRC20"],
  USDT: ["TRC20", "ERC20", "BEP20"],
};

export default function DepositPage() {
  const { submitToast } = useDemo();
  const [asset, setAsset] = useState("USDT");
  const [network, setNetwork] = useState("TRC20");
  const [walletType, setWalletType] = useState<"spot" | "funding">("funding");
  const [amount, setAmount] = useState("1500");
  const [record, setRecord] = useState<WalletDepositAddress | null>(null);
  const [busy, setBusy] = useState(false);

  const availableNetworks = useMemo(() => assetNetworks[asset] || ["ERC20"], [asset]);

  const generateAddress = async () => {
    setBusy(true);

    try {
      const response = await requestDepositAddress({ asset, network, walletType });
      setRecord(response);
      submitToast("Deposit address ready", "Use this address only for the selected asset and network.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to generate a deposit address right now.";
      submitToast("Address unavailable", message);
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

    if (!record?.address) {
      submitToast("Generate address first", "Create a deposit address before creating a deposit request.");
      return;
    }

    setBusy(true);

    try {
      const response = await createDepositRequest({ asset, network, amount: parsedAmount, walletType, address: record.address });
      submitToast("Deposit intent created", response.message || "Your deposit is now tracked in wallet activity.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "We couldn't create your deposit request. Please try again.";
      submitToast("Request unavailable", message);
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
                <select
                  value={asset}
                  onChange={(event) => {
                    const nextAsset = event.target.value;
                    setAsset(nextAsset);
                    const firstNetwork = assetNetworks[nextAsset]?.[0] || "ERC20";
                    setNetwork(firstNetwork);
                    setRecord(null);
                  }}
                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white"
                >
                  {Object.keys(assetNetworks).map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
                <select value={network} onChange={(event) => setNetwork(event.target.value)} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white">
                  {availableNetworks.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
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
                  <span className="truncate text-sm text-white">{record?.address || "Generate a new address to continue"}</span>
                  <button
                    type="button"
                    disabled={!record?.address}
                    onClick={() => {
                      if (!record?.address) {
                        return;
                      }
                      navigator.clipboard.writeText(record.address);
                      submitToast("Address copied", "Deposit address copied to clipboard.");
                    }}
                    className="text-muted hover:text-white disabled:opacity-40"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
                {record?.memo ? <p className="mt-2 text-xs text-muted">Memo/Tag: {record.memo}</p> : null}
                {record?.warnings?.length ? (
                  <div className="mt-2 space-y-1 text-xs text-muted">
                    {record.warnings.map((warning) => (
                      <p key={warning}>{warning}</p>
                    ))}
                  </div>
                ) : null}
                <div className="mt-6 flex h-40 items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/5 text-sm text-muted">
                  {record?.qrCodeDataUrl ? <img src={record.qrCodeDataUrl} alt="Deposit QR code" className="h-36 w-36 rounded-xl" /> : "QR code preview"}
                </div>
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
