import { PublicKey } from "@solana/web3.js";
import { NextResponse } from "next/server";

import { withLotteryServerRpc } from "@/lib/lottery/server-rpc";
import { clientIp, isLikelyBase58Pubkey, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Native SOL balance for a wallet (server RPC — browser public RPC 403s). */
export async function GET(request: Request) {
  const ip = clientIp(request);
  const limited = rateLimit(`sol-bal:${ip}`, 120, 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } },
    );
  }

  const owner = new URL(request.url).searchParams.get("owner")?.trim() ?? "";
  if (!isLikelyBase58Pubkey(owner)) {
    return NextResponse.json({ error: "Invalid owner" }, { status: 400 });
  }

  try {
    const lamports = await withLotteryServerRpc((connection) =>
      connection.getBalance(new PublicKey(owner), "confirmed"),
    );
    return NextResponse.json({ lamports });
  } catch (e) {
    const message = e instanceof Error ? e.message : "balance failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
