import { NextResponse } from "next/server";

import { fetchDrawPaidWithForApi } from "@/lib/lottery/fetch-draw-paid-with-api";
import { getDrawPaidWithCached } from "@/lib/lottery/draw-paid-with-cache";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const limit = rateLimit(`paid-with:${clientIp(request)}`, 30, 60_000);
  if (!limit.ok) {
    const cached = getDrawPaidWithCached(
      parseInt(new URL(request.url).searchParams.get("drawId") ?? "", 10) || -1,
    );
    if (cached) {
      return NextResponse.json(
        { paidWith: cached.paidWith, complete: cached.complete },
        {
          headers: {
            "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
          },
        },
      );
    }
    return NextResponse.json(
      { error: "Too many requests", paidWith: {}, complete: false },
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
        { paidWith: cached.paidWith, complete: cached.complete },
        {
          headers: {
            "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
          },
        },
      );
    }

    const { paidWith, complete } = await fetchDrawPaidWithForApi(drawId);
    return NextResponse.json(
      { paidWith, complete },
      {
        headers: {
          "Cache-Control": complete
            ? "public, s-maxage=300, stale-while-revalidate=600"
            : "no-store",
        },
      },
    );
  } catch {
    return NextResponse.json({ paidWith: {}, complete: false });
  }
}
