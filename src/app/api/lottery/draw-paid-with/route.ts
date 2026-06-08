import { NextResponse } from "next/server";

import { lotteryProgramId } from "@/lib/lottery/config";
import { fetchDrawPaidWithMints } from "@/lib/lottery/draw-paid-with";
import {
  getDrawPaidWithCached,
  setDrawPaidWithCached,
} from "@/lib/lottery/draw-paid-with-cache";
import { withLotteryServerRpc } from "@/lib/lottery/server-rpc";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  // This scans many signatures/transactions on each cache miss — throttle to
  // blunt cost amplification from unauthenticated spam.
  const limit = rateLimit(`paid-with:${clientIp(request)}`, 120, 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }

  const drawId = parseInt(
    new URL(request.url).searchParams.get("drawId") ?? "",
    10,
  );
  if (!Number.isFinite(drawId) || drawId < 0) {
    return NextResponse.json({ error: "Invalid drawId" }, { status: 400 });
  }
  try {
    const cached = getDrawPaidWithCached(drawId);
    if (cached) {
      return NextResponse.json(
        { paidWith: cached },
        {
          headers: {
            "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
          },
        },
      );
    }

    const paidWith = await withLotteryServerRpc((connection) =>
      fetchDrawPaidWithMints(connection, lotteryProgramId(), drawId),
    );
    if (Object.keys(paidWith).length > 0) {
      setDrawPaidWithCached(drawId, paidWith);
    }
    return NextResponse.json(
      { paidWith },
      {
        headers: {
          "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
        },
      },
    );
  } catch {
    return NextResponse.json({ paidWith: {} });
  }
}
