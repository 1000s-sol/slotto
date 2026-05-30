import { NextResponse } from "next/server";

import { buildDrawTokenMeta } from "@/lib/lottery/draw-token-meta";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const drawId = parseInt(
    new URL(request.url).searchParams.get("drawId") ?? "",
    10,
  );
  if (!Number.isFinite(drawId) || drawId < 0) {
    return NextResponse.json({ error: "Invalid drawId" }, { status: 400 });
  }
  try {
    const tokens = await buildDrawTokenMeta(drawId);
    return NextResponse.json(
      { tokens },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        },
      },
    );
  } catch {
    return NextResponse.json({ tokens: {} });
  }
}
