"use client";

import { useMemo, useState } from "react";
import { buildCryptoIconCandidates, getCryptoIconFallbackLabel } from "@/lib/markets/icons";

type CryptoIconProps = {
  symbol: string;
  src?: string | null;
  alt: string;
  size?: number;
  className?: string;
};

export function CryptoIcon({ symbol, src, alt, size = 24, className = "" }: CryptoIconProps) {
  const candidates = useMemo(() => buildCryptoIconCandidates(symbol, src), [symbol, src]);
  const [index, setIndex] = useState(0);
  const currentSrc = candidates[index];

  if (!currentSrc) {
    return (
      <div
        className={`flex items-center justify-center rounded-full border border-white/15 bg-slate-800 text-[10px] font-semibold text-slate-300 ${className}`}
        style={{ width: size, height: size }}
        aria-label={alt}
        title={alt}
      >
        {getCryptoIconFallbackLabel(symbol)}
      </div>
    );
  }

  return (
    <img
      src={currentSrc}
      alt={alt}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      className={`rounded-full bg-white/5 object-cover ${className}`}
      onError={() => setIndex((prev) => prev + 1)}
    />
  );
}

