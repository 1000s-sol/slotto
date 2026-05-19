"use server";

import * as anchor from "@coral-xyz/anchor";
import { Connection } from "@solana/web3.js";

import { crankDraw } from "./crank-draw";
import { lotteryProgramId } from "./config";
import { loadLotteryKeeperKeypair } from "./keeper-wallet";
import { createLotteryProgram } from "./program";

function rpcUrl(): string {
  return (
    process.env.LOTTERY_DEVNET_RPC?.trim() ||
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.trim() ||
    "https://api.devnet.solana.com"
  );
}

/** Server-only crank when the UI sees a draw awaiting settlement (instant, no cron secret). */
export async function triggerLotteryCrank(drawId: number): Promise<void> {
  if (!Number.isFinite(drawId) || drawId < 0) return;
  try {
    const payer = loadLotteryKeeperKeypair();
    if (!payer) return;
    const connection = new Connection(rpcUrl(), "confirmed");
    const programId = lotteryProgramId();
    const program = createLotteryProgram(
      connection,
      new anchor.Wallet(payer),
    );
    await crankDraw(connection, program, programId, drawId);
  } catch {
    /* cron or manual settle still works */
  }
}
