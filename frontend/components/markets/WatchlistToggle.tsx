"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

type WatchlistToggleProps = {
  active: boolean;
  onToggle: () => void;
  className?: string;
  label?: string;
};

export function WatchlistToggle({ active, onToggle, className, label = "Toggle watchlist" }: WatchlistToggleProps) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      className={cn(
        "rounded-full border border-white/10 p-2 text-muted transition hover:border-gold/40 hover:text-gold",
        active && "border-gold/40 bg-gold/10 text-gold",
        className,
      )}
      aria-label={label}
      title={label}
    >
      <Star className="h-4 w-4" fill={active ? "currentColor" : "none"} />
    </button>
  );
}

