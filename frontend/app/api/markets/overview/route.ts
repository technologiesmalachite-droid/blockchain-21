import { NextResponse } from "next/server";
import { getMarketsOverview } from "@/lib/markets/server";

export const revalidate = 30;

export async function GET() {
  const overview = await getMarketsOverview();
  return NextResponse.json(overview, {
    headers: {
      "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
    },
  });
}

