import { NextResponse } from "next/server";

import { withLotteryServerRpc } from "@/lib/lottery/server-rpc";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Recent blockhash for wallet txs (browser cannot use public Solana RPC). */
export async function GET(request: Request) {
  const limited = rateLimit(`lottery-blockhash:${clientIp(request)}`, 120, 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } },
    );
  }

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
