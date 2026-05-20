import { Connection } from "@solana/web3.js";

import { crankDraw } from "./crank-draw";
import { lotteryProgramId } from "./config";
import {
  keypairToAnchorWallet,
  loadLotteryKeeperKeypair,
} from "./keeper-wallet";
import { createLotteryProgram } from "./program";

import type { CrankTriggerResult } from "./trigger-crank-action";

function rpcUrl(): string {
  return (
    process.env.LOTTERY_DEVNET_RPC?.trim() ||
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.trim() ||
    "https://api.devnet.solana.com"
  );
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
      error: "Keeper wallet not configured on server",
    };
  }

  try {
    const connection = new Connection(rpcUrl(), "confirmed");
    const programId = lotteryProgramId();
    const program = createLotteryProgram(
      connection,
      keypairToAnchorWallet(payer),
    );
    const result = await crankDraw(connection, program, programId, drawId);
    const terminal =
      result.finalState === "Settled" || result.finalState === "Refunded";
    return {
      ok: terminal || result.signatures.length > 0,
      finalState: result.finalState,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Crank failed";
    console.error("[lottery crank] draw", drawId, message);
    return { ok: false, error: message };
  }
}
