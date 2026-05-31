import { NextResponse } from "next/server";

import { fetchDrawById } from "@/lib/lottery/chain";
import { lotteryProgramId } from "@/lib/lottery/config";
import { withLotteryServerRpc } from "@/lib/lottery/server-rpc";
import { fetchDrawEntrants } from "@/lib/lottery/ticket-holders";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Ticket holders for a draw (server RPC — browser cannot read ticket-chunk PDAs). */
export async function GET(request: Request) {
  const limit = rateLimit(`draw-entrants:${clientIp(request)}`, 120, 60_000);
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
    const entrants = await withLotteryServerRpc(async (connection) => {
      const programId = lotteryProgramId();
      const draw = await fetchDrawById(connection, programId, drawId);
      if (!draw || draw.totalTickets === 0) return [];
      return fetchDrawEntrants(connection, programId, draw);
    });
    return NextResponse.json(
      { entrants },
      {
        headers: {
          "Cache-Control": "public, s-maxage=10, stale-while-revalidate=20",
        },
      },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "entrants failed";
    return NextResponse.json({ error: message, entrants: [] }, { status: 500 });
  }
}
