import { QuoteAsset } from "@/lib/markets/types";

export const formatSignedPercent = (value: number) =>
  `${value > 0 ? "+" : ""}${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)}%`;

export const formatUsd = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: value < 1 ? 6 : 2,
  }).format(value);

export const formatCompactUsd = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);

export const formatPairPrice = (usdValue: number, quote: QuoteAsset, quoteUsdRate: number) => {
  const safeRate = quoteUsdRate > 0 ? quoteUsdRate : 1;
  const price = usdValue / safeRate;
  const decimals = quote === "BTC" || quote === "ETH" ? 8 : price < 1 ? 6 : 2;
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(price);
};

export const formatSupply = (value: number | null) => {
  if (!value || !Number.isFinite(value)) return "N/A";
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
};

export const percentTextColor = (value: number) => (value >= 0 ? "text-emerald-400" : "text-rose-400");

