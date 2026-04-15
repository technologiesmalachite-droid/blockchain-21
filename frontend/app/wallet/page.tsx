"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ContentSection, PageHero } from "@/components/PageShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  confirmWalletSwap,
  createWalletSwapQuote,
  fetchWalletAssetDetail,
  fetchWalletHistory,
  fetchWalletSummary,
  type WalletAssetDetail,
  type WalletHistoryItem,
  type WalletSummary,
  type WalletSwapQuote,
  type WalletTransactionsResponse,
} from "@/lib/api/private-data";
import { useAuth } from "@/lib/auth-provider";
import { useDemo } from "@/lib/demo-provider";
import { formatCurrency, formatNumber } from "@/lib/utils";

type WalletPageState = {
  loading: boolean;
  failed: boolean;
  summary: WalletSummary | null;
  history: WalletHistoryItem[];
  pagination: WalletTransactionsResponse["pagination"];
};

const initialState: WalletPageState = {
  loading: false,
  failed: false,
  summary: null,
  history: [],
  pagination: {
    page: 1,
    pageSize: 6,
    total: 0,
    totalPages: 1,
  },
};

const formatDate = (value?: string | null) => {
  if (!value) {
    return "Recent";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Recent";
  }
  return date.toLocaleString();
};

export default function WalletPage() {
  const { status } = useAuth();
  const { submitToast } = useDemo();
  const [state, setState] = useState<WalletPageState>(initialState);
  const [selectedAsset, setSelectedAsset] = useState<string>("USDT");
  const [assetDetail, setAssetDetail] = useState<WalletAssetDetail | null>(null);
  const [assetDetailLoading, setAssetDetailLoading] = useState(false);
  const [filters, setFilters] = useState({
    page: 1,
    pageSize: 6,
    type: "",
    status: "",
    search: "",
  });
  const [swapForm, setSwapForm] = useState({
    fromAsset: "USDT",
    toAsset: "BTC",
    amount: "100",
    walletType: "funding" as "spot" | "funding",
  });
  const [swapQuote, setSwapQuote] = useState<WalletSwapQuote | null>(null);
  const [swapBusy, setSwapBusy] = useState(false);

  const supportedAssets = useMemo(() => state.summary?.supportedAssets || [], [state.summary]);

  const loadWallet = async (nextFilters = filters) => {
    const [summaryPayload, historyPayload] = await Promise.all([
      fetchWalletSummary(),
      fetchWalletHistory({
        page: nextFilters.page,
        pageSize: nextFilters.pageSize,
        type: nextFilters.type || undefined,
        status: nextFilters.status || undefined,
        search: nextFilters.search || undefined,
      }),
    ]);

    setState({
      loading: false,
      failed: false,
      summary: summaryPayload,
      history: historyPayload.items || [],
      pagination: historyPayload.pagination,
    });

    const firstAsset = summaryPayload.assets?.[0]?.asset || summaryPayload.supportedAssets?.[0]?.asset || "USDT";
    const nextSelectedAsset = selectedAsset || firstAsset;
    setSelectedAsset(nextSelectedAsset);

    return nextSelectedAsset;
  };

  useEffect(() => {
    let active = true;

    if (status !== "authenticated") {
      setState(initialState);
      setAssetDetail(null);
      return () => {
        active = false;
      };
    }

    setState((current) => ({ ...current, loading: true, failed: false }));

    loadWallet(filters)
      .then(async (asset) => {
        if (!active) {
          return;
        }

        setAssetDetailLoading(true);
        try {
          const detail = await fetchWalletAssetDetail(asset);
          if (active) {
            setAssetDetail(detail);
          }
        } finally {
          if (active) {
            setAssetDetailLoading(false);
          }
        }
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

  const reloadHistory = async (nextFilters = filters) => {
    try {
      const historyPayload = await fetchWalletHistory({
        page: nextFilters.page,
        pageSize: nextFilters.pageSize,
        type: nextFilters.type || undefined,
        status: nextFilters.status || undefined,
        search: nextFilters.search || undefined,
      });

      setState((current) => ({
        ...current,
        history: historyPayload.items || [],
        pagination: historyPayload.pagination,
      }));
    } catch {
      submitToast("History unavailable", "Unable to refresh wallet activity right now.");
    }
  };

  const loadAssetDetail = async (asset: string) => {
    setSelectedAsset(asset);
    setAssetDetailLoading(true);

    try {
      const detail = await fetchWalletAssetDetail(asset);
      setAssetDetail(detail);
    } catch {
      setAssetDetail(null);
      submitToast("Asset detail unavailable", "Unable to load that asset right now.");
    } finally {
      setAssetDetailLoading(false);
    }
  };

  const requestSwapQuote = async () => {
    const amount = Number(swapForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      submitToast("Invalid amount", "Enter a valid swap amount.");
      return;
    }

    if (swapForm.fromAsset === swapForm.toAsset) {
      submitToast("Choose different assets", "Source and destination assets must be different.");
      return;
    }

    setSwapBusy(true);
    try {
      const response = await createWalletSwapQuote({
        fromAsset: swapForm.fromAsset,
        toAsset: swapForm.toAsset,
        amount,
        walletType: swapForm.walletType,
      });
      setSwapQuote(response.quote);
      submitToast("Swap quote ready", "Review rate, fee, and expiry before confirming.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to generate swap quote.";
      submitToast("Swap quote failed", message);
    } finally {
      setSwapBusy(false);
    }
  };

  const confirmSwap = async () => {
    if (!swapQuote) {
      return;
    }

    setSwapBusy(true);
    try {
      const response = await confirmWalletSwap({ quoteId: swapQuote.quoteId });
      submitToast("Swap completed", `Transaction hash: ${response.swap.txHash}`);
      setSwapQuote(null);
      await loadWallet(filters);
      await loadAssetDetail(selectedAsset);
      await reloadHistory(filters);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to complete swap.";
      submitToast("Swap failed", message);
    } finally {
      setSwapBusy(false);
    }
  };

  const totalBalance = state.summary?.totalPortfolioBalance || 0;

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
                      <p className="mt-2 text-4xl font-semibold text-white">{formatCurrency(totalBalance)}</p>
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
                  {!state.summary?.assets.length ? (
                    <p className="mt-4 text-sm text-muted">No wallet balances available yet.</p>
                  ) : (
                    <div className="mt-6 space-y-3 text-sm">
                      {state.summary.assets.map((asset) => (
                        <button
                          key={asset.asset}
                          type="button"
                          onClick={() => loadAssetDetail(asset.asset)}
                          className="grid w-full grid-cols-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left hover:border-white/20"
                        >
                          <span className="text-white">{asset.asset}</span>
                          <span className="text-muted">Total {formatNumber(asset.totalBalance, 6)}</span>
                          <span className="text-muted">Locked {formatNumber(asset.lockedBalance, 6)}</span>
                          <span className="text-muted">{formatCurrency(asset.fiatEquivalent)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </Card>
              </div>

              <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr]">
                <Card>
                  <p className="text-lg font-semibold text-white">Wallet swap / convert</p>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <select
                      value={swapForm.fromAsset}
                      onChange={(event) => setSwapForm((current) => ({ ...current, fromAsset: event.target.value }))}
                      className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white"
                    >
                      {supportedAssets.map((asset) => (
                        <option key={`from-${asset.asset}`} value={asset.asset}>
                          {asset.asset}
                        </option>
                      ))}
                    </select>
                    <select
                      value={swapForm.toAsset}
                      onChange={(event) => setSwapForm((current) => ({ ...current, toAsset: event.target.value }))}
                      className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white"
                    >
                      {supportedAssets.map((asset) => (
                        <option key={`to-${asset.asset}`} value={asset.asset}>
                          {asset.asset}
                        </option>
                      ))}
                    </select>
                    <input
                      value={swapForm.amount}
                      onChange={(event) => setSwapForm((current) => ({ ...current, amount: event.target.value }))}
                      className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white"
                      placeholder="Amount"
                    />
                    <select
                      value={swapForm.walletType}
                      onChange={(event) => setSwapForm((current) => ({ ...current, walletType: event.target.value as "spot" | "funding" }))}
                      className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white"
                    >
                      <option value="funding">Funding wallet</option>
                      <option value="spot">Spot wallet</option>
                    </select>
                  </div>
                  {swapQuote ? (
                    <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-muted">
                      <p>Rate: 1 {swapQuote.fromAsset} = {formatNumber(swapQuote.rate, 8)} {swapQuote.toAsset}</p>
                      <p className="mt-1">Fee: {formatNumber(swapQuote.feeAmount, 8)} {swapQuote.fromAsset}</p>
                      <p className="mt-1">You receive: {formatNumber(swapQuote.toAmount, 8)} {swapQuote.toAsset}</p>
                      <p className="mt-1">Quote expires: {formatDate(swapQuote.quoteExpiresAt)}</p>
                    </div>
                  ) : null}
                  <div className="mt-4 flex gap-3">
                    <Button onClick={requestSwapQuote} disabled={swapBusy}>{swapBusy ? "Working..." : "Get quote"}</Button>
                    <Button variant="secondary" onClick={confirmSwap} disabled={swapBusy || !swapQuote}>Confirm swap</Button>
                  </div>
                </Card>

                <Card>
                  <p className="text-lg font-semibold text-white">{selectedAsset} wallet detail</p>
                  {assetDetailLoading ? (
                    <p className="mt-4 text-sm text-muted">Loading asset detail...</p>
                  ) : assetDetail ? (
                    <>
                      <div className="mt-4 grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm md:grid-cols-3">
                        <div>
                          <p className="text-muted">Total</p>
                          <p className="text-white">{formatNumber(assetDetail.totals.totalBalance, 8)}</p>
                        </div>
                        <div>
                          <p className="text-muted">Available</p>
                          <p className="text-white">{formatNumber(assetDetail.totals.availableBalance, 8)}</p>
                        </div>
                        <div>
                          <p className="text-muted">Locked</p>
                          <p className="text-white">{formatNumber(assetDetail.totals.lockedBalance, 8)}</p>
                        </div>
                      </div>
                      <div className="mt-4 text-sm text-muted">
                        Networks: {assetDetail.networks.join(", ") || "-"}
                      </div>
                      <div className="mt-3 space-y-2 text-sm">
                        {assetDetail.addresses.slice(0, 2).map((address) => (
                          <div key={address.id} className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
                            <p className="text-white">{address.network}</p>
                            <p className="truncate text-muted">{address.address}</p>
                          </div>
                        ))}
                        {!assetDetail.addresses.length ? <p className="text-muted">No deposit addresses generated yet.</p> : null}
                      </div>
                    </>
                  ) : (
                    <p className="mt-4 text-sm text-muted">No asset details available.</p>
                  )}
                </Card>
              </div>

              <div className="mt-6">
                <Card>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-lg font-semibold text-white">Wallet activity</p>
                    <div className="flex flex-wrap gap-2">
                      <input
                        value={filters.search}
                        onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                        className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"
                        placeholder="Search address or hash"
                      />
                      <select
                        value={filters.type}
                        onChange={(event) => setFilters((current) => ({ ...current, type: event.target.value }))}
                        className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"
                      >
                        <option value="">All types</option>
                        <option value="deposit">Deposit</option>
                        <option value="withdrawal">Withdrawal</option>
                        <option value="wallet_transfer">Transfer</option>
                        <option value="swap">Swap</option>
                        <option value="trade_buy">Trade buy</option>
                        <option value="trade_sell">Trade sell</option>
                      </select>
                      <select
                        value={filters.status}
                        onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
                        className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"
                      >
                        <option value="">All status</option>
                        <option value="pending_confirmation">Pending</option>
                        <option value="queued">Queued</option>
                        <option value="under_review">Under review</option>
                        <option value="completed">Completed</option>
                        <option value="failed">Failed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                      <Button
                        variant="secondary"
                        onClick={() => {
                          const next = { ...filters, page: 1 };
                          setFilters(next);
                          reloadHistory(next);
                        }}
                      >
                        Apply
                      </Button>
                    </div>
                  </div>

                  {!state.history.length ? (
                    <p className="mt-4 text-sm text-muted">No wallet activity yet.</p>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {state.history.map((entry) => (
                        <div key={entry.id} className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm md:grid-cols-7">
                          <span className="text-white">{entry.type}</span>
                          <span className="text-muted">{entry.asset}</span>
                          <span className="text-muted">{entry.network}</span>
                          <span className="text-muted">{formatNumber(entry.amount, 8)}</span>
                          <span className="text-muted">{entry.status}</span>
                          <span className="truncate text-muted">{entry.txHash || entry.address || "-"}</span>
                          <span className="text-muted">{formatDate(entry.createdAt)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-4 flex items-center justify-between text-sm text-muted">
                    <p>Page {state.pagination.page} of {state.pagination.totalPages}</p>
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        disabled={state.pagination.page <= 1}
                        onClick={() => {
                          const next = { ...filters, page: Math.max(1, filters.page - 1) };
                          setFilters(next);
                          reloadHistory(next);
                        }}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={state.pagination.page >= state.pagination.totalPages}
                        onClick={() => {
                          const next = { ...filters, page: filters.page + 1 };
                          setFilters(next);
                          reloadHistory(next);
                        }}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </Card>
              </div>
            </>
          )}
        </ProtectedRoute>
      </ContentSection>
    </>
  );
}
