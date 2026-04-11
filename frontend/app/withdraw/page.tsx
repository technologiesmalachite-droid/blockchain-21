"use client";

import { useState } from "react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ContentSection, PageHero } from "@/components/PageShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { createWithdrawRequest } from "@/lib/api/private-data";
import { useDemo } from "@/lib/demo-provider";

export default function WithdrawPage() {
  const { submitToast } = useDemo();
  const [asset, setAsset] = useState("BTC");
  const [network, setNetwork] = useState("Bitcoin");
  const [walletType, setWalletType] = useState<"spot" | "funding">("funding");
  const [address, setAddress] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [amount, setAmount] = useState("0.05");
  const [busy, setBusy] = useState(false);

  const submitWithdrawal = async () => {
    const parsedAmount = Number(amount);

    if (!address.trim()) {
      submitToast("Address required", "Enter a destination address before submitting.");
      return;
    }

    if (!twoFactorCode.trim()) {
      submitToast("2FA required", "Enter your two-factor code to authorize withdrawal.");
      return;
    }

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      submitToast("Invalid amount", "Enter a valid withdrawal amount before continuing.");
      return;
    }

    setBusy(true);

    try {
      await createWithdrawRequest({
        asset,
        network,
        amount: parsedAmount,
        address,
        walletType,
        twoFactorCode,
      });
      submitToast("Withdrawal submitted", "Your withdrawal entered risk and compliance checks.");
    } catch {
      submitToast("Request unavailable", "We couldn't submit your withdrawal request. Verify KYC, contact checks, and 2FA.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHero
        eyebrow="Withdraw"
        title="Submit a secure withdrawal request"
        description="Authorize withdrawal with 2FA, destination checks, and compliance-aware risk scoring before release."
        badge="Private page"
      />
      <ContentSection>
        <ProtectedRoute>
          <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
            <Card>
              <div className="grid gap-4 md:grid-cols-2">
                <select value={asset} onChange={(event) => setAsset(event.target.value)} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white">
                  <option>BTC</option>
                  <option>USDT</option>
                  <option>ETH</option>
                </select>
                <select value={network} onChange={(event) => setNetwork(event.target.value)} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white">
                  <option>Bitcoin</option>
                  <option>ERC20</option>
                  <option>TRC20</option>
                </select>
                <select value={walletType} onChange={(event) => setWalletType(event.target.value as "spot" | "funding")} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white">
                  <option value="funding">Funding wallet</option>
                  <option value="spot">Spot wallet</option>
                </select>
                <input value={amount} onChange={(event) => setAmount(event.target.value)} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white" />
              </div>
              <input
                placeholder="Destination address"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                className="mt-4 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white"
              />
              <input
                placeholder="2FA code"
                value={twoFactorCode}
                onChange={(event) => setTwoFactorCode(event.target.value)}
                className="mt-4 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white"
              />
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-muted">
                Estimated fee model: 0.10% of withdrawal amount. Final fee is confirmed at custody processing.
              </div>
              <Button className="mt-6 w-full" onClick={submitWithdrawal} disabled={busy}>
                {busy ? "Submitting..." : "Confirm withdrawal"}
              </Button>
            </Card>
            <Card>
              <p className="text-lg font-semibold text-white">Withdrawal safeguards</p>
              <div className="mt-4 space-y-3 text-sm text-muted">
                <p>Address and network mismatches can lead to irreversible loss.</p>
                <p>High-risk withdrawals enter manual compliance review.</p>
                <p>Accounts with pending KYC or unverified contact are blocked from withdrawal.</p>
              </div>
              <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-muted">
                Requirement gates: authenticated session, verified email/phone, approved KYC, and valid 2FA.
              </div>
            </Card>
          </div>
        </ProtectedRoute>
      </ContentSection>
    </>
  );
}
