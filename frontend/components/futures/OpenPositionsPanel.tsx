"use client";

import { useEffect, useState } from "react";
import { UnauthorizedStateCard } from "@/components/auth/UnauthorizedStateCard";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { fetchOpenPositions, type OpenPosition } from "@/lib/api/private-data";
import { useAuth } from "@/lib/auth-provider";
import { formatNumber } from "@/lib/utils";

type OpenPositionsState = {
  loading: boolean;
  positions: OpenPosition[];
  failed: boolean;
};

const initialState: OpenPositionsState = {
  loading: false,
  positions: [],
  failed: false,
};

export function OpenPositionsPanel() {
  const { status } = useAuth();
  const [state, setState] = useState<OpenPositionsState>(initialState);

  useEffect(() => {
    let active = true;

    if (status !== "authenticated") {
      setState(initialState);
      return () => {
        active = false;
      };
    }

    setState({ loading: true, positions: [], failed: false });

    fetchOpenPositions()
      .then((payload) => {
        if (!active) {
          return;
        }

        setState({
          loading: false,
          positions: payload.items || [],
          failed: false,
        });
      })
      .catch(() => {
        if (!active) {
          return;
        }

        setState({
          loading: false,
          positions: [],
          failed: true,
        });
      });

    return () => {
      active = false;
    };
  }, [status]);

  if (status === "loading") {
    return (
      <Card className="border-white/15 bg-black/25">
        <p className="text-xl font-semibold text-white">Loading open positions</p>
        <p className="mt-2 text-sm text-muted">We are preparing your futures position data.</p>
      </Card>
    );
  }

  if (status !== "authenticated") {
    return (
      <UnauthorizedStateCard
        title="Sign in to view your open positions"
        subtitle="Login or create an account to access futures positions, orders, and wallet activity."
      />
    );
  }

  if (state.loading) {
    return (
      <Card className="border-white/15 bg-black/25">
        <p className="text-xl font-semibold text-white">Loading open positions</p>
        <div className="mt-5 space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-12 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
          ))}
        </div>
      </Card>
    );
  }

  if (state.failed) {
    return (
      <Card className="border-white/15 bg-black/25">
        <p className="text-xl font-semibold text-white">Unable to load positions</p>
        <p className="mt-2 text-sm text-muted">Please refresh the page or sign in again to continue.</p>
      </Card>
    );
  }

  if (!state.positions.length) {
    return (
      <Card className="border-white/15 bg-black/25">
        <p className="text-xl font-semibold text-white">No open positions yet</p>
        <p className="mt-2 text-sm text-muted">Your active futures positions will appear here.</p>
      </Card>
    );
  }

  return (
    <Card className="border-white/15 bg-black/25">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-2xl font-semibold text-white">Open Positions</h3>
        <Badge>Live account</Badge>
      </div>
      <div className="space-y-3">
        {state.positions.map((position) => (
          <div key={position.id} className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm md:grid-cols-6">
            <span className="font-medium text-white">{position.symbol}</span>
            <span className={position.side === "buy" ? "text-emerald-400" : "text-rose-400"}>{position.side.toUpperCase()}</span>
            <span className="text-muted">{position.orderType}</span>
            <span className="text-muted">{formatNumber(position.quantity, 4)}</span>
            <span className="text-muted">{formatNumber(position.price, 2)}</span>
            <span className="text-muted">{position.status}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
