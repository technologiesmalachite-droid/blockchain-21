"use client";

import { ContentSection, PageHero } from "@/components/PageShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useDemo } from "@/lib/demo-provider";

export default function WithdrawPage() {
  const { submitToast, addTransaction } = useDemo();

  return (
    <>
      <PageHero eyebrow="Withdraw" title="Submit a secure withdrawal request with fee awareness and warnings" description="Choose the asset and network, enter the destination address, preview fees, and progress through security confirmation states." badge="Security review enabled" />
      <ContentSection>
        <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
          <Card>
            <div className="grid gap-4 md:grid-cols-2">
              <select className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white"><option>BTC</option><option>USDT</option><option>ETH</option></select>
              <select className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white"><option>Bitcoin</option><option>ERC20</option><option>TRC20</option></select>
            </div>
            <input placeholder="Destination address" className="mt-4 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white" />
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <input defaultValue="0.05" className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white" />
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-muted">Available balance: 0.7462 BTC</div>
            </div>
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-muted">Estimated network + platform fee: 0.0002 BTC</div>
            <Button
              className="mt-6 w-full"
              onClick={() => {
                addTransaction({ type: "Withdrawal", asset: "BTC", amount: "0.05", status: "Under review" });
                submitToast("Withdrawal submitted", "Your request has entered the demo security confirmation flow.");
              }}
            >
              Confirm withdrawal
            </Button>
          </Card>
          <Card>
            <p className="text-lg font-semibold text-white">Warnings</p>
            <div className="mt-4 space-y-3 text-sm text-muted">
              <p>Verify the address and network before submitting.</p>
              <p>Large withdrawals may trigger review or identity confirmation.</p>
              <p>Whitelisting, 2FA, and anti-phishing controls should be enabled before live deployment.</p>
            </div>
            <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-muted">Recent withdrawal: BTC 0.05 | Under review | 2026-04-06 08:10 UTC</div>
          </Card>
        </div>
      </ContentSection>
    </>
  );
}
