import { PublicKey } from "@solana/web3.js";
import { NextResponse } from "next/server";

import { withLotteryServerRpc } from "@/lib/lottery/server-rpc";
import { fetchWalletMintBalance } from "@/lib/lottery/wallet-mint-balance";
import { clientIp, isLikelyBase58Pubkey, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** SPL token balance for a wallet (server RPC — browser public RPC 403s). */
export async function GET(request: Request) {
  const ip = clientIp(request);
  const limited = rateLimit(`lottery-bal:${ip}`, 120, 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } },
    );
  }

  const url = new URL(request.url);
  const owner = url.searchParams.get("owner")?.trim() ?? "";
  const mint = url.searchParams.get("mint")?.trim() ?? "";

  if (!isLikelyBase58Pubkey(owner) || !isLikelyBase58Pubkey(mint)) {
    return NextResponse.json({ error: "Invalid owner or mint" }, { status: 400 });
  }

  try {
    const ownerPk = new PublicKey(owner);
    const mintPk = new PublicKey(mint);
    const result = await withLotteryServerRpc((connection) =>
      fetchWalletMintBalance(connection, ownerPk, mintPk),
    );
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "balance lookup failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
