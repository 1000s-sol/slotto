import { NextResponse } from "next/server";
import { Connection } from "@solana/web3.js";

import { lotteryProgramId } from "@/lib/lottery/config";
import { fetchDrawPaidWithMints } from "@/lib/lottery/draw-paid-with";
import { resolveLotteryRpcUrl } from "@/lib/lottery/rpc-url";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const drawId = parseInt(
    new URL(request.url).searchParams.get("drawId") ?? "",
    10,
  );
  if (!Number.isFinite(drawId) || drawId < 0) {
    return NextResponse.json({ error: "Invalid drawId" }, { status: 400 });
  }
  try {
    const connection = new Connection(resolveLotteryRpcUrl(), "confirmed");
    const paidWith = await fetchDrawPaidWithMints(
      connection,
      lotteryProgramId(),
      drawId,
    );
    return NextResponse.json(
      { paidWith },
      {
        headers: {
          "Cache-Control": "public, s-maxage=20, stale-while-revalidate=40",
        },
      },
    );
  } catch {
    return NextResponse.json({ paidWith: {} });
  }
}
