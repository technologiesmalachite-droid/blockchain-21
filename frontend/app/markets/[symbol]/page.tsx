import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CoinDetailClientPage } from "@/components/markets/CoinDetailClientPage";
import { BRAND_NAME } from "@/lib/brand";
import { getCoinDetailBySymbol } from "@/lib/markets/server";

type SymbolPageProps = {
  params: {
    symbol: string;
  };
};

export const revalidate = 30;

export async function generateMetadata({ params }: SymbolPageProps): Promise<Metadata> {
  const detail = await getCoinDetailBySymbol(params.symbol);
  if (!detail) {
    return {
      title: "Asset Not Found",
      description: "The requested market asset could not be found.",
    };
  }
  return {
    title: `${detail.name} (${detail.symbol}) Price, Market Cap & Charts`,
    description: `Track ${detail.name} live price, 24h change, volume, market cap, supply, and active trading pairs on ${BRAND_NAME}.`,
  };
}

export default async function SymbolPage({ params }: SymbolPageProps) {
  const detail = await getCoinDetailBySymbol(params.symbol);
  if (!detail) notFound();
  return <CoinDetailClientPage symbol={params.symbol} initialDetail={detail} />;
}
