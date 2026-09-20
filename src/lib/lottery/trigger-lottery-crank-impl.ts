import { Connection } from "@solana/web3.js";

import { fetchDrawById } from "./chain";
import { crankDraw } from "./crank-draw";
import { lotteryProgramId } from "./config";
import { DrawState } from "./constants";
import {
  keypairToAnchorWallet,
  loadLotteryKeeperKeypair,
} from "./keeper-wallet";
import { postSettleAnnouncements } from "./post-settle-announcements";
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

function isTerminalState(state: string): boolean {
  return state === "Settled" || state === "Refunded";
}

async function crankOnRpc(
  rpcUrl: string,
  drawId: number,
  payer: NonNullable<ReturnType<typeof loadLotteryKeeperKeypair>>,
  opts?: { maxPasses?: number; vrfWaitMs?: number; stepWaitMs?: number },
): Promise<CrankTriggerResult> {
  const connection = new Connection(rpcUrl, "confirmed");
  const programId = lotteryProgramId();
  const program: SlottoLotteryProgram = createLotteryProgram(
    connection,
    keypairToAnchorWallet(payer),
  );

  /** Switchboard VRF often needs close → request → wait → reveal → settle. */
  const maxPasses = Math.min(Math.max(opts?.maxPasses ?? 8, 1), 8);
  const vrfWaitMs = opts?.vrfWaitMs ?? 8_000;
  const stepWaitMs = opts?.stepWaitMs ?? 4_000;
  let lastFinalState = "unknown";
  let totalSigs = 0;

  for (let pass = 0; pass < maxPasses; pass += 1) {
    const draw = await fetchDrawById(connection, programId, drawId);
    if (!draw) {
      return { ok: false, error: `Draw #${drawId} not found` };
    }
    if (
      draw.state === DrawState.Settled ||
      draw.state === DrawState.Refunded
    ) {
      lastFinalState = draw.state === DrawState.Settled ? "Settled" : "Refunded";
      try {
        await postSettleAnnouncements(connection, drawId, {
          finalState: lastFinalState,
          winner: draw.winner,
        });
      } catch (e) {
        console.warn("[lottery announce] ended hook failed:", e);
      }
      return { ok: true, finalState: lastFinalState };
    }

    const result = await crankDraw(
      connection,
      program,
      programId,
      drawId,
      payer,
    );
    lastFinalState = result.finalState;
    totalSigs += result.signatures.length;

    if (isTerminalState(result.finalState)) {
      try {
        await postSettleAnnouncements(connection, drawId, {
          finalState: result.finalState,
          winner: result.winner,
        });
      } catch (e) {
        console.warn("[lottery announce] ended hook failed:", e);
      }
      return { ok: true, finalState: result.finalState };
    }

    if (pass < maxPasses - 1) {
      const waitMs =
        result.finalState === "VrfRequested" ? vrfWaitMs : stepWaitMs;
      await sleep(waitMs);
    }
  }

  if (isTerminalState(lastFinalState)) {
    try {
      const settled = await fetchDrawById(connection, programId, drawId);
      await postSettleAnnouncements(connection, drawId, {
        finalState: lastFinalState,
        winner: settled?.winner ?? null,
      });
    } catch (e) {
      console.warn("[lottery announce] ended hook failed:", e);
    }
    return { ok: true, finalState: lastFinalState };
  }

  return {
    ok: totalSigs > 0,
    finalState: lastFinalState,
    error:
      totalSigs === 0
        ? `Crank incomplete (still ${lastFinalState})`
        : lastFinalState === "VrfRequested"
          ? `VRF requested (still ${lastFinalState}) — wait ~10s then click Settle again`
          : `Crank in progress (still ${lastFinalState}) — click Settle again`,
  };
}

/**
 * Per-draw throttle for the public crank. Collapses concurrent calls for the
 * same draw; cooldown applies between full multi-pass runs.
 */
const inFlightCrank = new Map<number, Promise<CrankTriggerResult>>();
const lastCrankAt = new Map<number, number>();
const CRANK_COOLDOWN_MS = 3_000;

export type TriggerLotteryCrankOptions = {
  /** Admin settle uses 1–2 passes so the button returns; cron keeps default 8. */
  maxPasses?: number;
  vrfWaitMs?: number;
  stepWaitMs?: number;
};

/** Server-only: close_sales → request_vrf → settle for one draw (multi-pass). */
export async function runTriggerLotteryCrank(
  drawId: number,
  opts?: TriggerLotteryCrankOptions,
): Promise<CrankTriggerResult> {
  if (!Number.isFinite(drawId) || drawId < 0) {
    return { ok: false, error: "Invalid draw id" };
  }

  const existing = inFlightCrank.get(drawId);
  if (existing) return existing;

  const last = lastCrankAt.get(drawId) ?? 0;
  if (Date.now() - last < CRANK_COOLDOWN_MS) {
    return {
      ok: false,
      error: "Settle already running or just finished — wait a few seconds and click again.",
    };
  }

  const run = crankDrawOnce(drawId, opts);
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
  opts?: TriggerLotteryCrankOptions,
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
    return await crankOnRpc(primaryRpc, drawId, payer, opts);
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
        return await crankOnRpc(fallbackRpc, drawId, payer, opts);
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
