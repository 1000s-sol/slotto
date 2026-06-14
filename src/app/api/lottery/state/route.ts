import { NextResponse } from "next/server";

import { lotteryProgramId } from "@/lib/lottery/config";
import { fetchLotteryState } from "@/lib/lottery/fetch-lottery-state";
import { withLotteryStateCache } from "@/lib/lottery/lottery-state-cache";
import { withLotteryServerRpc } from "@/lib/lottery/server-rpc";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const state = await withLotteryStateCache(() =>
      withLotteryServerRpc((connection) =>
        fetchLotteryState(connection, lotteryProgramId()),
      ),
    );
    return NextResponse.json(state, {
      headers: {
        "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load lottery state";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
