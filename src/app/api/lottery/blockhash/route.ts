import { NextResponse } from "next/server";

import { withLotteryServerRpc } from "@/lib/lottery/server-rpc";

export const dynamic = "force-dynamic";

/** Recent blockhash for wallet txs (browser cannot use public Solana RPC). */
export async function GET() {
  try {
    const latest = await withLotteryServerRpc((connection) =>
      connection.getLatestBlockhash("confirmed"),
    );
    return NextResponse.json({
      blockhash: latest.blockhash,
      lastValidBlockHeight: latest.lastValidBlockHeight,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "blockhash failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
