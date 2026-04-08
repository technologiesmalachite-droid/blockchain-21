import { NextRequest, NextResponse } from "next/server";
import { getCoinDetailBySymbol } from "@/lib/markets/server";

export const revalidate = 30;

export async function GET(_request: NextRequest, { params }: { params: { symbol: string } }) {
  const detail = await getCoinDetailBySymbol(params.symbol);

  if (!detail) {
    return NextResponse.json({ message: "Coin not found." }, { status: 404 });
  }

  return NextResponse.json(detail, {
    headers: {
      "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
    },
  });
}

