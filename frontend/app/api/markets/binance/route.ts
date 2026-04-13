import { NextResponse } from "next/server";
import { getMarketsSnapshot } from "@/lib/markets/server";

export const revalidate = 15;

export async function GET() {
  const snapshot = await getMarketsSnapshot();
  const status = snapshot.items.length > 0 ? 200 : 503;

  return NextResponse.json(snapshot, {
    status,
    headers: {
      "Cache-Control": "public, s-maxage=15, stale-while-revalidate=45",
    },
  });
}

