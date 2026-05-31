import { NextResponse } from "next/server";

import { lotteryProgramId } from "@/lib/lottery/config";
import { fetchDrawPaidWithMints } from "@/lib/lottery/draw-paid-with";
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
    const paidWith = await withLotteryServerRpc((connection) =>
      fetchDrawPaidWithMints(connection, lotteryProgramId(), drawId),
    );
    return NextResponse.json(
      { paidWith },
      {
        headers: {
          "Cache-Control": "public, s-maxage=20, stale-while-revalidate=40",
        },
      },
    );
  } catch {
    return NextResponse.json({ paidWith: {} });
  }
}
