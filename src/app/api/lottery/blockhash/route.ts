import { Connection } from "@solana/web3.js";
import { NextResponse } from "next/server";

import { resolveLotteryRpcUrl } from "@/lib/lottery/rpc-url";

export const dynamic = "force-dynamic";

/** Recent blockhash for wallet txs (browser cannot use public Solana RPC). */
export async function GET() {
  try {
    const connection = new Connection(resolveLotteryRpcUrl(), "confirmed");
    const latest = await connection.getLatestBlockhash("confirmed");
    return NextResponse.json({
      blockhash: latest.blockhash,
      lastValidBlockHeight: latest.lastValidBlockHeight,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "blockhash failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
