"use client";

import { MarketTab } from "@/lib/markets/types";
import { cn } from "@/lib/utils";

type TabConfig = {
  key: MarketTab;
  label: string;
};

const tabs: TabConfig[] = [
  { key: "overview", label: "Overview" },
  { key: "spot", label: "Spot" },
  { key: "futures", label: "Futures" },
  { key: "favorites", label: "Favorites" },
  { key: "gainers", label: "Top Gainers" },
  { key: "losers", label: "Top Losers" },
  { key: "volume", label: "Top Volume" },
  { key: "new", label: "New Listings" },
];

type MarketsTabsProps = {
  activeTab: MarketTab;
  onChange: (tab: MarketTab) => void;
  favoritesCount: number;
};

export function MarketsTabs({ activeTab, onChange, favoritesCount }: MarketsTabsProps) {
  return (
    <div className="overflow-x-auto">
      <div className="inline-flex min-w-full gap-2 rounded-2xl border border-white/10 bg-white/5 p-1.5">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={cn(
              "whitespace-nowrap rounded-xl px-3 py-2 text-sm transition",
              activeTab === tab.key ? "bg-accent text-slate-950" : "text-muted hover:text-white",
            )}
          >
            {tab.label}
            {tab.key === "favorites" ? ` (${favoritesCount})` : ""}
          </button>
        ))}
      </div>
    </div>
  );
}

