"use client";

import { useEffect, useMemo, useState } from "react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ContentSection, PageHero } from "@/components/PageShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { createWithdrawRequest, estimateWithdrawFee, fetchWalletAssetDetail, type WalletWithdrawalFeeEstimate } from "@/lib/api/private-data";
import { useDemo } from "@/lib/demo-provider";
import { formatNumber } from "@/lib/utils";

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

export default function WithdrawPage() {
  const { submitToast } = useDemo();
  const [asset, setAsset] = useState("BTC");
  const [network, setNetwork] = useState("BTC");
  const [walletType, setWalletType] = useState<"spot" | "funding">("funding");
  const [address, setAddress] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [amount, setAmount] = useState("0.05");
  const [availableBalance, setAvailableBalance] = useState<number>(0);
  const [feeEstimate, setFeeEstimate] = useState<WalletWithdrawalFeeEstimate | null>(null);
  const [reviewMode, setReviewMode] = useState(false);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const availableNetworks = useMemo(() => assetNetworks[asset] || ["ERC20"], [asset]);

  useEffect(() => {
    let active = true;

    fetchWalletAssetDetail(asset, walletType)
      .then((detail) => {
        if (!active) {
          return;
        }
        setAvailableBalance(detail.totals.availableBalance || 0);
      })
      .catch(() => {
        if (!active) {
          return;
        }
        setAvailableBalance(0);
      });

    return () => {
      active = false;
    };
  }, [asset, walletType]);

  useEffect(() => {
    let active = true;
    const parsedAmount = Number(amount);

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setFeeEstimate(null);
      return () => {
        active = false;
      };
    }

    estimateWithdrawFee({ asset, network, amount: parsedAmount, walletType })
      .then((response) => {
        if (active) {
          setFeeEstimate(response.estimate);
        }
      })
      .catch(() => {
        if (active) {
          setFeeEstimate(null);
        }
      });

    return () => {
      active = false;
    };
  }, [asset, network, amount, walletType]);

  const openReview = () => {
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

    if (parsedAmount > availableBalance) {
      submitToast("Insufficient balance", "Your available balance is lower than this withdrawal amount.");
      return;
    }

    setReviewMode(true);
  };

  const submitWithdrawal = async () => {
    const parsedAmount = Number(amount);
    setBusy(true);

    try {
      const response = await createWithdrawRequest({
        asset,
        network,
        amount: parsedAmount,
        address,
        walletType,
        twoFactorCode,
      });
      setLastTxHash(response.record?.txHash || null);
      setReviewMode(false);
      submitToast("Withdrawal submitted", response.message || "Your withdrawal entered risk and compliance checks.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "We couldn't submit your withdrawal request.";
      submitToast("Request unavailable", message);
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
                <select
                  value={asset}
                  onChange={(event) => {
                    const nextAsset = event.target.value;
                    setAsset(nextAsset);
                    setNetwork(assetNetworks[nextAsset]?.[0] || "ERC20");
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
                <div className="flex gap-2">
                  <input value={amount} onChange={(event) => setAmount(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white" />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setAmount(String(availableBalance || 0))}
                  >
                    Max
                  </Button>
                </div>
              </div>
              <p className="mt-2 text-xs text-muted">Available balance: {formatNumber(availableBalance, 8)} {asset}</p>
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
                <p>Estimated fee: {feeEstimate ? `${formatNumber(feeEstimate.feeAmount, 8)} ${asset}` : "-"}</p>
                <p className="mt-1">Total debit: {feeEstimate ? `${formatNumber(feeEstimate.totalDebit, 8)} ${asset}` : "-"}</p>
                {feeEstimate?.warnings?.map((warning) => (
                  <p key={warning} className="mt-1">{warning}</p>
                ))}
              </div>
              {reviewMode ? (
                <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-muted">
                  <p>Review withdrawal before final submission:</p>
                  <p className="mt-1">{asset} {amount} on {network}</p>
                  <p className="mt-1">To: {address}</p>
                  <div className="mt-3 flex gap-2">
                    <Button onClick={submitWithdrawal} disabled={busy}>{busy ? "Submitting..." : "Confirm withdrawal"}</Button>
                    <Button variant="secondary" onClick={() => setReviewMode(false)} disabled={busy}>Back</Button>
                  </div>
                </div>
              ) : (
                <Button className="mt-6 w-full" onClick={openReview} disabled={busy}>
                  Review withdrawal
                </Button>
              )}
              {lastTxHash ? (
                <p className="mt-3 text-xs text-muted">Last withdrawal reference: {lastTxHash}</p>
              ) : null}
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
