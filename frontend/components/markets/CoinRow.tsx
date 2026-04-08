"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { NormalizedCoinMarket, QuoteAsset } from "@/lib/markets/types";
import {
  formatCompactUsd,
  formatPairPrice,
  formatSignedPercent,
  formatSupply,
  percentTextColor,
} from "@/lib/markets/format";
import { CoinSparkline } from "@/components/markets/CoinSparkline";
import { WatchlistToggle } from "@/components/markets/WatchlistToggle";

type CoinRowProps = {
  coin: NormalizedCoinMarket;
  quote: QuoteAsset;
  quoteRate: number;
  favorite: boolean;
  onToggleFavorite: (symbol: string) => void;
};

export function CoinRow({ coin, quote, quoteRate, favorite, onToggleFavorite }: CoinRowProps) {
  const router = useRouter();
  const quotePair = `${coin.symbol}/${quote}`;
  const [imageFailed, setImageFailed] = useState(false);
  const showLogo = Boolean(coin.image) && !imageFailed;

  return (
    <tr
      onClick={() => router.push(`/markets/${coin.symbol.toLowerCase()}`)}
      className="cursor-pointer border-b border-white/5 text-sm text-white transition hover:bg-white/5"
    >
      <td className="px-4 py-3 text-muted">{coin.rank}</td>
      <td className="px-4 py-3">
        <WatchlistToggle
          active={favorite}
          onToggle={() => onToggleFavorite(coin.symbol)}
          label={`Toggle ${coin.symbol} in favorites`}
        />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          {showLogo ? (
            <Image
              src={coin.image}
              width={28}
              height={28}
              alt={`${coin.name} logo`}
              className="rounded-full bg-white/5"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-slate-800 text-[10px] font-semibold text-slate-300">
              {coin.symbol.slice(0, 2)}
            </div>
          )}
          <div>
            <p className="font-medium">{coin.name}</p>
            <p className="text-xs text-muted">{quotePair}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-muted">{coin.symbol}</td>
      <td className="px-4 py-3 text-right font-medium">{formatPairPrice(coin.currentPriceUsd, quote, quoteRate)}</td>
      <td className={`px-4 py-3 text-right ${percentTextColor(coin.change24h)}`}>{formatSignedPercent(coin.change24h)}</td>
      <td className="px-4 py-3 text-right text-muted">{formatCompactUsd(coin.volume24hUsd)}</td>
      <td className="px-4 py-3 text-right text-muted">{formatCompactUsd(coin.marketCapUsd)}</td>
      <td className="px-4 py-3 text-right">{formatPairPrice(coin.high24hUsd, quote, quoteRate)}</td>
      <td className="px-4 py-3 text-right">{formatPairPrice(coin.low24hUsd, quote, quoteRate)}</td>
      <td className="px-4 py-3 text-right text-muted">{formatSupply(coin.circulatingSupply)}</td>
      <td className="px-4 py-3">
        <CoinSparkline points={coin.sparkline7d} positive={coin.change24h >= 0} />
      </td>
    </tr>
  );
}
