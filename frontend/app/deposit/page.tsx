"use client";

import { Copy } from "lucide-react";
import { ContentSection, PageHero } from "@/components/PageShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useDemo } from "@/lib/demo-provider";

export default function DepositPage() {
  const { submitToast, addTransaction } = useDemo();

  return (
    <>
      <PageHero eyebrow="Deposit" title="Prepare an incoming crypto deposit with network-aware instructions" description="Select the asset and network, copy the address, review warnings, and use the QR placeholder as part of a wallet-safe deposit flow." badge="Demo address only" />
      <ContentSection>
        <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
          <Card>
            <div className="grid gap-4 md:grid-cols-2">
              <select className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white"><option>USDT</option><option>BTC</option><option>ETH</option></select>
              <select className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white"><option>TRC20</option><option>ERC20</option><option>BEP20</option></select>
            </div>
            <div className="mt-6 rounded-3xl border border-white/10 bg-black/20 p-6">
              <p className="text-sm text-muted">Wallet address</p>
              <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                <span className="truncate text-sm text-white">MXDemoTRC20WalletAddress9v2nA7ZaP</span>
                <button onClick={() => submitToast("Address copied", "Demo deposit address copied to clipboard placeholder.")} className="text-muted hover:text-white"><Copy className="h-4 w-4" /></button>
              </div>
              <div className="mt-6 flex h-48 items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/5 text-sm text-muted">QR placeholder</div>
            </div>
          </Card>
          <Card>
            <p className="text-lg font-semibold text-white">Important instructions</p>
            <div className="mt-4 space-y-3 text-sm text-muted">
              <p>Only send the selected asset through the chosen network.</p>
              <p>Deposits require blockchain confirmations before balance crediting.</p>
              <p>Sending unsupported assets or using the wrong network may result in permanent loss.</p>
            </div>
            <Button
              className="mt-6 w-full"
              onClick={() => {
                addTransaction({ type: "Deposit", asset: "USDT", amount: "1,500", status: "Pending" });
                submitToast("Deposit request created", "A simulated deposit event was added to your account history.");
              }}
            >
              Generate deposit request
            </Button>
          </Card>
        </div>
      </ContentSection>
    </>
  );
}
