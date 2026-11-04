import { NextResponse } from "next/server";

import { walletsAllowedForDrawSocial } from "@/lib/lottery/draw-social-wallets";
import { clientIp, isLikelyBase58Pubkey, rateLimit } from "@/lib/rate-limit";
import { getSocialByWallets } from "@/lib/user-profile-db";

export const dynamic = "force-dynamic";

/** Cap per request so a single call can't fan out into many Discord lookups. */
const MAX_WALLETS = 50;

/**
 * Public wallet → Discord/X for lottery UI. Requires `drawId` and only returns
 * profiles for wallets that hold tickets (or won) that draw — blocks bulk
 * harvesting of arbitrary addresses.
 */
export async function GET(request: Request) {
  const limit = rateLimit(`social:${clientIp(request)}`, 240, 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }

  const url = new URL(request.url);
  const drawId = parseInt(url.searchParams.get("drawId") ?? "", 10);
  if (!Number.isFinite(drawId) || drawId < 0) {
    return NextResponse.json(
      { error: "drawId is required" },
      { status: 400 },
    );
  }

  const raw = url.searchParams.get("wallets") ?? "";
  const requested = Array.from(
    new Set(
      raw
        .split(",")
        .map((w) => w.trim())
        .filter((w) => isLikelyBase58Pubkey(w)),
    ),
  ).slice(0, MAX_WALLETS);
  if (requested.length === 0) {
    return NextResponse.json({ profiles: {} });
  }

  let allowed: Set<string>;
  try {
    allowed = await walletsAllowedForDrawSocial(drawId);
  } catch (e) {
    const message = e instanceof Error ? e.message : "draw lookup failed";
    return NextResponse.json({ error: message, profiles: {} }, { status: 500 });
  }

  const wallets = requested.filter((w) => allowed.has(w));
  if (wallets.length === 0) {
    return NextResponse.json({ profiles: {} });
  }

  const profiles = await getSocialByWallets(wallets);
  return NextResponse.json({ profiles });
}
