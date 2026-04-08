import { NextResponse } from "next/server";
import { getMarketsSnapshot } from "@/lib/markets/server";

export const revalidate = 30;

export async function GET() {
  const snapshot = await getMarketsSnapshot();
  return NextResponse.json(snapshot, {
    headers: {
      "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
    },
  });
}

