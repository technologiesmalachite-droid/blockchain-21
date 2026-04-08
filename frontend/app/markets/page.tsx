import type { Metadata } from "next";
import { MarketsClientPage } from "@/components/markets/MarketsClientPage";
import { BRAND_NAME } from "@/lib/brand";
import { getMarketsOverview, getMarketsSnapshot } from "@/lib/markets/server";

export const metadata: Metadata = {
  title: "Markets",
  description:
    `Track crypto prices, market cap, 24h movers, volume leaders, watchlists, and detailed asset analytics on ${BRAND_NAME} Markets.`,
};

export const revalidate = 30;

export default async function MarketsPage() {
  const [snapshot, overview] = await Promise.all([getMarketsSnapshot(), getMarketsOverview()]);
  return <MarketsClientPage initialSnapshot={snapshot} initialOverview={overview} />;
}
