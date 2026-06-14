import { NextResponse } from "next/server";

import { fetchSplMintRowsForDraw } from "@/lib/lottery/spl-catalog-db";
import { batchMintLotteryBuySupported } from "@/lib/lottery/mint-program-cache";
import { withLotteryServerRpc } from "@/lib/lottery/server-rpc";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Postgres SPL UI rows for a draw (light RPC: one batched mint lookup, cached). */
export async function GET(request: Request) {
  const ip = clientIp(request);
  const limited = rateLimit(`draw-spl:${ip}`, 60, 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } },
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
    const rows = await fetchSplMintRowsForDraw(drawId);
    const mints = rows.map((r) => r.mint);
    let supportedByMint: Record<string, boolean> = {};
    if (mints.length > 0) {
      try {
        supportedByMint = await withLotteryServerRpc((connection) =>
          batchMintLotteryBuySupported(connection, mints),
        );
      } catch {
        // Helius 429 — keep SPL buy dropdown usable; on-chain buy still validates mint program.
      }
    }

    const rowsWithSupport = rows.map((row) => ({
      ...row,
      lotteryBuySupported: supportedByMint[row.mint] ?? true,
    }));

    return NextResponse.json(
      { rows: rowsWithSupport },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load draw SPL";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
