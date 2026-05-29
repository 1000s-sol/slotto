import { Connection } from "@solana/web3.js";

import { crankDraw } from "./crank-draw";
import { lotteryProgramId } from "./config";
import {
  keypairToAnchorWallet,
  loadLotteryKeeperKeypair,
} from "./keeper-wallet";
import { createLotteryProgram } from "./program";
import type { SlottoLotteryProgram } from "./program";

import {
  lotteryPublicRpcFallback,
  resolveLotteryRpcUrl,
} from "@/lib/lottery/rpc-url";
import type { CrankTriggerResult } from "./trigger-crank-action";

function isRpcAuthError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("401") ||
    lower.includes("invalid api key") ||
    lower.includes("-32401") ||
    lower.includes("unauthorized")
  );
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

/** Server-only: close_sales → request_vrf → settle for one draw. */
export async function runTriggerLotteryCrank(
  drawId: number,
): Promise<CrankTriggerResult> {
  if (!Number.isFinite(drawId) || drawId < 0) {
    return { ok: false, error: "Invalid draw id" };
  }

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
    const message = e instanceof Error ? e.message : "Crank failed";

    if (fallbackRpc && isRpcAuthError(message) && primaryRpc !== fallbackRpc) {
      console.warn(
        "[lottery crank] RPC auth failed on",
        primaryRpc.replace(/api-key=[^&]+/, "api-key=***"),
        "— retrying public devnet",
      );
      try {
        return await crankOnRpc(fallbackRpc, drawId, payer);
      } catch (retryErr) {
        const retryMsg =
          retryErr instanceof Error ? retryErr.message : "Crank failed";
        console.error("[lottery crank] draw", drawId, retryMsg);
        return { ok: false, error: retryMsg };
      }
    }

    console.error("[lottery crank] draw", drawId, message);
    return { ok: false, error: message };
  }
}
