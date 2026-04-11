"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ContentSection, PageHero } from "@/components/PageShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { fetchWalletBalances, fetchWalletHistory, type WalletBalance, type WalletHistoryItem } from "@/lib/api/private-data";
import { useAuth } from "@/lib/auth-provider";
import { formatCurrency, formatNumber } from "@/lib/utils";

type WalletState = {
  loading: boolean;
  failed: boolean;
  totalBalance: number;
  balances: WalletBalance[];
  history: WalletHistoryItem[];
};

const initialState: WalletState = {
  loading: false,
  failed: false,
  totalBalance: 0,
  balances: [],
  history: [],
};

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Recent";
  }
  return date.toLocaleString();
};

export default function WalletPage() {
  const { status } = useAuth();
  const [state, setState] = useState<WalletState>(initialState);

  useEffect(() => {
    let active = true;

    if (status !== "authenticated") {
      setState(initialState);
      return () => {
        active = false;
      };
    }

    setState((current) => ({ ...current, loading: true, failed: false }));

    Promise.all([fetchWalletBalances(), fetchWalletHistory()])
      .then(([balancesPayload, historyPayload]) => {
        if (!active) {
          return;
        }

        setState({
          loading: false,
          failed: false,
          totalBalance: balancesPayload.totalBalance,
          balances: balancesPayload.balances || [],
          history: historyPayload.items || [],
        });
      })
      .catch(() => {
        if (!active) {
          return;
        }

        setState({
          ...initialState,
          failed: true,
        });
      });

    return () => {
      active = false;
    };
  }, [status]);

  return (
    <>
      <PageHero
        eyebrow="Wallet"
        title="Portfolio visibility, balances, and recent account activity"
        description="Track holdings, monitor wallet events, and move into deposit or withdrawal flows from a secure dashboard."
        badge="Private page"
      />
      <ContentSection>
        <ProtectedRoute>
          {state.loading ? (
            <Card className="border-white/15 bg-black/25">
              <p className="text-xl font-semibold text-white">Loading wallet data</p>
              <p className="mt-2 text-sm text-muted">Fetching balances and account activity...</p>
            </Card>
          ) : state.failed ? (
            <Card className="border-white/15 bg-black/25">
              <p className="text-xl font-semibold text-white">Wallet data unavailable</p>
              <p className="mt-2 text-sm text-muted">Please refresh the page or sign in again.</p>
            </Card>
          ) : (
            <>
              <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                <Card>
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-sm text-muted">Total portfolio balance</p>
                      <p className="mt-2 text-4xl font-semibold text-white">{formatCurrency(state.totalBalance)}</p>
                    </div>
                    <div className="flex gap-3">
                      <Link href="/deposit">
                        <Button>Deposit</Button>
                      </Link>
                      <Link href="/withdraw">
                        <Button variant="secondary">Withdraw</Button>
                      </Link>
                    </div>
                  </div>
                  <p className="mt-6 text-sm text-muted">Balances are protected and only loaded after session validation.</p>
                </Card>
                <Card>
                  <p className="text-lg font-semibold text-white">Portfolio mix</p>
                  {!state.balances.length ? (
                    <p className="mt-4 text-sm text-muted">No wallet balances available yet.</p>
                  ) : (
                    <div className="mt-6 space-y-3 text-sm">
                      {state.balances.map((asset) => (
                        <div key={`${asset.walletType}-${asset.asset}`} className="grid grid-cols-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                          <span className="text-white">{asset.walletType.toUpperCase()} {asset.asset}</span>
                          <span className="text-muted">Balance {formatNumber(asset.balance, 6)}</span>
                          <span className="text-muted">Available {formatNumber(asset.available, 6)}</span>
                          <span className="text-muted">Avg {formatCurrency(asset.averageCost, 4)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>

              <div className="mt-6">
                <Card>
                  <p className="mb-4 text-lg font-semibold text-white">Recent wallet activity</p>
                  {!state.history.length ? (
                    <p className="text-sm text-muted">No wallet activity yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {state.history.slice(0, 6).map((entry) => (
                        <div key={entry.id} className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm md:grid-cols-6">
                          <span className="text-white">{entry.type}</span>
                          <span className="text-muted">{entry.asset}</span>
                          <span className="text-muted">{entry.network}</span>
                          <span className="text-muted">{formatNumber(entry.amount, 6)}</span>
                          <span className="text-muted">{entry.status}</span>
                          <span className="text-muted">{formatDate(entry.createdAt)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>
            </>
          )}
        </ProtectedRoute>
      </ContentSection>
    </>
  );
}
