import { NextResponse } from "next/server";

import { lotteryProgramId } from "@/lib/lottery/config";
import {
  fetchPastSettledDraws,
  fetchSettledDrawPrizeLamports,
  lotteryDrawViewToJson,
} from "@/lib/lottery/draws";
import {
  formatDrawDisplayLabel,
  getDrawDisplayMetaMap,
} from "@/lib/lottery/draw-display-db";
import { isPastWinnerDrawVisible } from "@/lib/lottery/past-winners-filter";
import { withLotteryServerRpc } from "@/lib/lottery/server-rpc";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export type PastWinnerApiRow = {
  drawId: number;
  displayLabel: string;
  displayNumber: number | null;
  salesCloseTs: number;
  winner: string;
  totalTickets: number;
  winningTicketId: number;
  prizeLamports: number;
};

/** Settled draws with prize amounts (server RPC — browser cannot read prize vault history). */
export async function GET(request: Request) {
  const limit = rateLimit(`past-winners:${clientIp(request)}`, 60, 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }

  try {
    const rows = await withLotteryServerRpc(async (connection) => {
      const programId = lotteryProgramId();
      const settled = await fetchPastSettledDraws(connection, programId);
      const visible = settled.filter((d) => d.winner);
      const metaMap = await getDrawDisplayMetaMap(
        visible.map((d) => d.drawId),
      );
      const out: PastWinnerApiRow[] = [];
      for (const draw of visible) {
        if (!(await isPastWinnerDrawVisible(draw.drawId))) continue;
        const meta = metaMap.get(draw.drawId);
        if (!meta || meta.kind !== "PRODUCTION") continue;
        const prizeLamports = await fetchSettledDrawPrizeLamports(
          connection,
          draw,
        );
        const json = lotteryDrawViewToJson(draw);
        out.push({
          drawId: json.drawId,
          displayLabel: formatDrawDisplayLabel(meta),
          displayNumber: meta.displayNumber,
          salesCloseTs: json.salesCloseTs,
          winner: json.winner!,
          totalTickets: json.totalTickets,
          winningTicketId: json.winningTicketId,
          prizeLamports,
        });
      }
      return out.sort((a, b) => (b.displayNumber ?? 0) - (a.displayNumber ?? 0));
    });
    return NextResponse.json(
      { draws: rows },
      {
        headers: {
          "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30",
        },
      },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "past winners failed";
    return NextResponse.json({ error: message, draws: [] }, { status: 500 });
  }
}
