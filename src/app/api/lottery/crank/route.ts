import { Connection } from "@solana/web3.js";
import { NextResponse } from "next/server";

import {
  crankAllPendingDraws,
  crankDraw,
} from "@/lib/lottery/crank-draw";
import { lotteryProgramId } from "@/lib/lottery/config";
import {
  keypairToAnchorWallet,
  loadLotteryKeeperKeypair,
} from "@/lib/lottery/keeper-wallet";
import { createLotteryProgram } from "@/lib/lottery/program";
import { resolveLotteryRpcUrl } from "@/lib/lottery/rpc-url";

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

function authorized(request: Request): boolean {
  const secret = cronSecret();
  if (!secret) return true;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

async function handleCrank(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payer = loadLotteryKeeperKeypair();
  if (!payer) {
    return NextResponse.json(
      {
        error:
          "Keeper keypair not configured (LOTTERY_KEEPER_WALLET or LOTTERY_TEST_WALLET)",
      },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const drawIdParam = url.searchParams.get("drawId");
  const connection = new Connection(resolveLotteryRpcUrl(), "confirmed");
  const programId = lotteryProgramId();
  const program = createLotteryProgram(
    connection,
    keypairToAnchorWallet(payer),
  );

  try {
    if (drawIdParam !== null) {
      const drawId = parseInt(drawIdParam, 10);
      if (!Number.isFinite(drawId) || drawId < 0) {
        return NextResponse.json({ error: "Invalid drawId" }, { status: 400 });
      }
      const result = await crankDraw(connection, program, programId, drawId);
      return NextResponse.json({ ok: true, results: [result] });
    }

    const results = await crankAllPendingDraws(connection, program, programId);
    return NextResponse.json({ ok: true, results });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Crank failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Vercel cron uses GET; manual / UI triggers may use POST. */
export async function GET(request: Request) {
  return handleCrank(request);
}

export async function POST(request: Request) {
  return handleCrank(request);
}
