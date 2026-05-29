import { Connection } from "@solana/web3.js";
import { NextResponse } from "next/server";

import { lotteryProgramId } from "@/lib/lottery/config";
import { fetchLotteryState } from "@/lib/lottery/fetch-lottery-state";
import { resolveLotteryRpcUrl } from "@/lib/lottery/rpc-url";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const connection = new Connection(resolveLotteryRpcUrl(), "confirmed");
    const state = await fetchLotteryState(connection, lotteryProgramId());
    return NextResponse.json(state);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load lottery state";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
