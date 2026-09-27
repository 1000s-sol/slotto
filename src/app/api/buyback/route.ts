import { NextResponse } from "next/server";

import { fetchBuybackSnapshot } from "@/lib/lottery/buyback-data";
import { lotteryRpcErrorText } from "@/lib/lottery/user-facing-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  try {
    const snapshot = await fetchBuybackSnapshot();
    return NextResponse.json(snapshot, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    });
  } catch (e) {
    console.error("[buyback]", e);
    return NextResponse.json(
      { error: lotteryRpcErrorText(e) },
      { status: 500 },
    );
  }
}
