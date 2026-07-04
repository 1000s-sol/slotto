import { PublicKey } from "@solana/web3.js";
import { NextResponse } from "next/server";

import { withLotteryServerRpc } from "@/lib/lottery/server-rpc";
import { clientIp, isLikelyBase58Pubkey, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Whether a token or system account exists (server RPC). */
export async function GET(request: Request) {
  const ip = clientIp(request);
  const limited = rateLimit(`acct-exists:${ip}`, 120, 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } },
    );
  }

  const address =
    new URL(request.url).searchParams.get("address")?.trim() ?? "";
  if (!isLikelyBase58Pubkey(address)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  try {
    const exists = await withLotteryServerRpc(async (connection) => {
      const info = await connection.getAccountInfo(
        new PublicKey(address),
        "confirmed",
      );
      return info != null;
    });
    return NextResponse.json({ exists });
  } catch (e) {
    const message = e instanceof Error ? e.message : "lookup failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
