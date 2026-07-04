import { NextResponse } from "next/server";

import { lotteryProgramId } from "@/lib/lottery/config";
import { fetchLotteryState } from "@/lib/lottery/fetch-lottery-state";
import { withLotteryStateCache } from "@/lib/lottery/lottery-state-cache";
import { withLotteryServerRpc } from "@/lib/lottery/server-rpc";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const preview =
      new URL(request.url).searchParams.get("preview") === "1";
    const state = await withLotteryStateCache(preview ? "preview" : "public", () =>
      withLotteryServerRpc((connection) =>
        fetchLotteryState(connection, lotteryProgramId(), { preview }),
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
