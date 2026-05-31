import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { NextResponse } from "next/server";

import { withLotteryServerRpc } from "@/lib/lottery/server-rpc";
import { clientIp, isLikelyBase58Pubkey, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** SPL token balance for a wallet ATA (server RPC — browser public RPC 403s). */
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
    const ata = getAssociatedTokenAddressSync(mintPk, ownerPk);

    const result = await withLotteryServerRpc(async (connection) => {
      try {
        const bal = await connection.getTokenAccountBalance(ata, "confirmed");
        return {
          amount: bal.value.amount,
          decimals: bal.value.decimals,
          ata: ata.toBase58(),
        };
      } catch {
        return { amount: "0", decimals: 0, ata: ata.toBase58() };
      }
    });

    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "balance lookup failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
