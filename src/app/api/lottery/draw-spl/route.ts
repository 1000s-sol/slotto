import { NextResponse } from "next/server";

import { fetchSplMintRowsForDraw } from "@/lib/lottery/spl-catalog-db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const drawId = parseInt(
    new URL(request.url).searchParams.get("drawId") ?? "",
    10,
  );
  if (!Number.isFinite(drawId) || drawId < 0) {
    return NextResponse.json({ error: "Invalid drawId" }, { status: 400 });
  }
  const rows = await fetchSplMintRowsForDraw(drawId);
  return NextResponse.json({ rows });
}
