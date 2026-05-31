import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { fetchDrawIdsNeedingCrank } from "@/lib/lottery/crank-draw";
import { lotteryProgramId } from "@/lib/lottery/config";
import { loadLotteryKeeperKeypair } from "@/lib/lottery/keeper-wallet";
import { withLotteryServerRpc } from "@/lib/lottery/server-rpc";
import { runTriggerLotteryCrank } from "@/lib/lottery/trigger-lottery-crank-impl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function cronSecret(): string | undefined {
  return (
    process.env.LOTTERY_CRON_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    undefined
  );
}

function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

function authorized(request: Request): boolean {
  const secret = cronSecret();
  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }
  const auth = request.headers.get("authorization") ?? "";
  return constantTimeEqual(auth, `Bearer ${secret}`);
}

async function handleCrank(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!loadLotteryKeeperKeypair()) {
    return NextResponse.json(
      {
        error:
          "Keeper keypair not configured (LOTTERY_KEEPER_SECRET_KEY on Vercel)",
      },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const drawIdParam = url.searchParams.get("drawId");

  try {
    if (drawIdParam !== null) {
      const drawId = parseInt(drawIdParam, 10);
      if (!Number.isFinite(drawId) || drawId < 0) {
        return NextResponse.json({ error: "Invalid drawId" }, { status: 400 });
      }
      const result = await runTriggerLotteryCrank(drawId);
      return NextResponse.json({
        ok: result.ok,
        results: [{ drawId, ...result }],
      });
    }

    const ids = await withLotteryServerRpc((connection) =>
      fetchDrawIdsNeedingCrank(connection, lotteryProgramId()),
    );

    if (ids.length === 0) {
      return NextResponse.json({ ok: true, results: [], message: "No draws need crank" });
    }

    const results = [];
    for (const drawId of ids) {
      const result = await runTriggerLotteryCrank(drawId);
      results.push({ drawId, ...result });
    }

    return NextResponse.json({
      ok: results.every((r) => r.ok),
      results,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Crank failed";
    console.error("[lottery crank route]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Vercel cron uses GET; GitHub Actions / manual triggers may use POST. */
export async function GET(request: Request) {
  return handleCrank(request);
}

export async function POST(request: Request) {
  return handleCrank(request);
}
