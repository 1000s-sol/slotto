import { Connection } from "@solana/web3.js";
import { NextResponse } from "next/server";

import { lotteryProgramId } from "@/lib/lottery/config";
import { fetchDrawById } from "@/lib/lottery/chain";
import { fetchSplMintRowsForDraw } from "@/lib/lottery/spl-catalog-db";
import { resolveLotteryRpcUrl } from "@/lib/lottery/rpc-url";
import {
  splDbMintsMatchChain,
  syncDrawSplRowsFromChain,
} from "@/lib/lottery/sync-draw-spl-from-chain";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const drawId = parseInt(
    new URL(request.url).searchParams.get("drawId") ?? "",
    10,
  );
  if (!Number.isFinite(drawId) || drawId < 0) {
    return NextResponse.json({ error: "Invalid drawId" }, { status: 400 });
  }

  const connection = new Connection(resolveLotteryRpcUrl(), "confirmed");
  const programId = lotteryProgramId();
  const draw = await fetchDrawById(connection, programId, drawId);
  let rows = await fetchSplMintRowsForDraw(drawId);

  if (draw && draw.splMints.length > 0) {
    const chainMints = draw.splMints.map((m) => m.mint);
    const dbMints = rows.map((r) => r.mint);
    if (!splDbMintsMatchChain(dbMints, chainMints)) {
      await syncDrawSplRowsFromChain(connection, programId, drawId);
      rows = await fetchSplMintRowsForDraw(drawId);
    }
  }

  return NextResponse.json({ rows });
}
