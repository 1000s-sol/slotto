import { PublicKey } from "@solana/web3.js";
import { NextResponse } from "next/server";

import { resolveMintTokenProgram } from "@/lib/lottery/mint-token-program";
import { withLotteryServerRpc } from "@/lib/lottery/server-rpc";
import { clientIp, isLikelyBase58Pubkey, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Token vs Token-2022 program id for a mint (server RPC — never expose Helius keys to browser). */
export async function GET(request: Request) {
  const ip = clientIp(request);
  const limited = rateLimit(`mint-prog:${ip}`, 120, 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } },
    );
  }

  const mint = new URL(request.url).searchParams.get("mint")?.trim() ?? "";
  if (!isLikelyBase58Pubkey(mint)) {
    return NextResponse.json({ error: "Invalid mint" }, { status: 400 });
  }

  try {
    const mintPk = new PublicKey(mint);
    const tokenProgram = await withLotteryServerRpc((connection) =>
      resolveMintTokenProgram(connection, mintPk),
    );
    if (!tokenProgram) {
      return NextResponse.json({ error: "Mint not found" }, { status: 404 });
    }
    return NextResponse.json({ tokenProgram: tokenProgram.toBase58() });
  } catch (e) {
    const message = e instanceof Error ? e.message : "mint lookup failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
