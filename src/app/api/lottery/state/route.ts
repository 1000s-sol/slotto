import { NextResponse } from "next/server";

import { lotteryProgramId } from "@/lib/lottery/config";
import { fetchLotteryState } from "@/lib/lottery/fetch-lottery-state";
import { withLotteryServerRpc } from "@/lib/lottery/server-rpc";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const state = await withLotteryServerRpc((connection) =>
      fetchLotteryState(connection, lotteryProgramId()),
    );
    return NextResponse.json(state);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load lottery state";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
