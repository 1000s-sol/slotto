import { NextResponse } from "next/server";

import { clientIp, isLikelyBase58Pubkey, rateLimit } from "@/lib/rate-limit";
import { getSocialByWallets } from "@/lib/user-profile-db";

export const dynamic = "force-dynamic";

/** Cap per request so a single call can't fan out into many Discord lookups. */
const MAX_WALLETS = 50;

export async function GET(request: Request) {
  const limit = rateLimit(`social:${clientIp(request)}`, 240, 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }

  const raw = new URL(request.url).searchParams.get("wallets") ?? "";
  const wallets = Array.from(
    new Set(
      raw
        .split(",")
        .map((w) => w.trim())
        .filter((w) => isLikelyBase58Pubkey(w)),
    ),
  ).slice(0, MAX_WALLETS);
  if (wallets.length === 0) {
    return NextResponse.json({ profiles: {} });
  }
  const profiles = await getSocialByWallets(wallets);
  return NextResponse.json({ profiles });
}
