import { NextResponse } from "next/server";

import { clientIp, isLikelyBase58Pubkey, rateLimit } from "@/lib/rate-limit";
import { getAccountClusterByWallet } from "@/lib/user-profile-db";

export const dynamic = "force-dynamic";

/** Socials and sibling wallets for a connected address. */
export async function GET(request: Request) {
  const limit = rateLimit(`cluster:${clientIp(request)}`, 120, 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }

  const wallet = new URL(request.url).searchParams.get("wallet")?.trim() ?? "";
  if (!isLikelyBase58Pubkey(wallet)) {
    return NextResponse.json({ social: null, wallets: [] });
  }

  const cluster = await getAccountClusterByWallet(wallet);
  if (!cluster) {
    return NextResponse.json({ social: { discord: null, x: null }, wallets: [] });
  }
  return NextResponse.json(cluster);
}
