import { Connection } from "@solana/web3.js";

import { announceDrawEnded } from "./announce-draw";
import { fetchDrawById } from "./chain";
import { crankDraw } from "./crank-draw";
import { fetchSettledDrawPrizeLamports } from "./draws";
import { lotteryProgramId } from "./config";
import {
  keypairToAnchorWallet,
  loadLotteryKeeperKeypair,
} from "./keeper-wallet";
import { createLotteryProgram } from "./program";
import type { SlottoLotteryProgram } from "./program";

import {
  isRpcFallbackError,
  isRpcRateLimitError,
  lotteryPublicRpcFallback,
  resolveLotteryRpcUrl,
} from "@/lib/lottery/rpc-url";
import { lotteryRpcErrorText } from "@/lib/lottery/user-facing-error";
import type { CrankTriggerResult } from "./trigger-crank-action";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function crankOnRpc(
  rpcUrl: string,
  drawId: number,
  payer: NonNullable<ReturnType<typeof loadLotteryKeeperKeypair>>,
): Promise<CrankTriggerResult> {
  const connection = new Connection(rpcUrl, "confirmed");
  const programId = lotteryProgramId();
  const program: SlottoLotteryProgram = createLotteryProgram(
    connection,
    keypairToAnchorWallet(payer),
  );
  const result = await crankDraw(
    connection,
    program,
    programId,
    drawId,
    payer,
  );
  const terminal =
    result.finalState === "Settled" || result.finalState === "Refunded";

  if (terminal) {
    // Best-effort official X announcement; idempotent + never blocks the crank.
    try {
      const refunded = result.finalState === "Refunded";
      const dv = await fetchDrawById(connection, programId, drawId);
      const prizeLamports =
        dv && !refunded
          ? await fetchSettledDrawPrizeLamports(connection, dv)
          : undefined;
      await announceDrawEnded({
        drawId,
        winner: result.winner,
        prizeLamports,
        totalTickets: dv?.totalTickets ?? 0,
        refunded,
      });
    } catch (e) {
      console.warn("[lottery announce] ended hook failed:", e);
    }
  }

  return {
    ok: terminal || result.signatures.length > 0,
    finalState: result.finalState,
    error: terminal
      ? undefined
      : result.signatures.length === 0
        ? `Crank incomplete (still ${result.finalState})`
        : undefined,
  };
}

/**
 * Per-draw throttle for the public crank. This action is callable by any
 * visitor (the homepage triggers it so draws settle without wallet popups), so
 * we (a) collapse concurrent calls for the same draw into one in-flight run and
 * (b) enforce a short cooldown between runs. This caps keeper RPC/tx work under
 * spam. Best-effort per server instance — the durable fix is an authenticated
 * cron worker.
 */
const inFlightCrank = new Map<number, Promise<CrankTriggerResult>>();
const lastCrankAt = new Map<number, number>();
const CRANK_COOLDOWN_MS = 4_000;

/** Server-only: close_sales → request_vrf → settle for one draw. */
export async function runTriggerLotteryCrank(
  drawId: number,
): Promise<CrankTriggerResult> {
  if (!Number.isFinite(drawId) || drawId < 0) {
    return { ok: false, error: "Invalid draw id" };
  }

  const existing = inFlightCrank.get(drawId);
  if (existing) return existing;

  const last = lastCrankAt.get(drawId) ?? 0;
  if (Date.now() - last < CRANK_COOLDOWN_MS) {
    // Benign no-op: another crank just ran for this draw (common when many
    // viewers settle the same draw at once). Don't surface an error or trigger
    // UI backoff — the next poll picks up the new on-chain state.
    return { ok: true };
  }

  const run = crankDrawOnce(drawId);
  inFlightCrank.set(drawId, run);
  try {
    return await run;
  } finally {
    inFlightCrank.delete(drawId);
    lastCrankAt.set(drawId, Date.now());
  }
}

async function crankDrawOnce(
  drawId: number,
): Promise<CrankTriggerResult> {
  const payer = loadLotteryKeeperKeypair();
  if (!payer) {
    console.error("[lottery crank] LOTTERY_KEEPER_SECRET_KEY not configured");
    return {
      ok: false,
      error:
        "Keeper not configured on Vercel (set LOTTERY_KEEPER_SECRET_KEY)",
    };
  }

  const primaryRpc = resolveLotteryRpcUrl();
  const fallbackRpc = lotteryPublicRpcFallback();

  try {
    return await crankOnRpc(primaryRpc, drawId, payer);
  } catch (e) {
    const message = lotteryRpcErrorText(e);

    if (isRpcRateLimitError(message)) {
      await sleep(2500);
    }

    if (isRpcFallbackError(message) && primaryRpc !== fallbackRpc) {
      console.warn(
        "[lottery crank] primary RPC failed — retrying public cluster fallback",
      );
      try {
        return await crankOnRpc(fallbackRpc, drawId, payer);
      } catch (retryErr) {
        const retryMsg = lotteryRpcErrorText(retryErr);
        console.error("[lottery crank] draw", drawId, retryMsg);
        return { ok: false, error: retryMsg };
      }
    }

    console.error("[lottery crank] draw", drawId, message);
    return { ok: false, error: message };
  }
}
