"use server";

import { fetchDrawIdsNeedingCrank } from "./crank-draw";
import { lotteryProgramId } from "./config";
import { loadLotteryKeeperKeypair } from "./keeper-wallet";
import { allowUiSettlementCrank } from "./public-crank";
import { runTriggerLotteryCrank } from "./trigger-lottery-crank-impl";
import { withLotteryServerRpc } from "./server-rpc";

export type CrankTriggerResult = {
  ok: boolean;
  error?: string;
  finalState?: string;
};

export type CrankUiResult = {
  ok: boolean;
  error?: string;
};

/** Server action: crank when the UI sees a draw awaiting settlement. */
export async function triggerLotteryCrank(
  drawId: number,
): Promise<CrankTriggerResult> {
  if (!Number.isFinite(drawId) || drawId < 0) {
    return { ok: false, error: "Invalid draw id" };
  }

  if (!allowUiSettlementCrank()) {
    return {
      ok: false,
      error:
        "UI settlement crank disabled — waiting on server cron. Refresh shortly.",
    };
  }

  if (!loadLotteryKeeperKeypair()) {
    return {
      ok: false,
      error:
        "Keeper not configured on Vercel (set LOTTERY_KEEPER_SECRET_KEY)",
    };
  }

  const needsCrank = await withLotteryServerRpc(async (connection) => {
    const ids = await fetchDrawIdsNeedingCrank(connection, lotteryProgramId());
    return ids.includes(drawId);
  });

  if (!needsCrank) {
    return { ok: true };
  }

  return runTriggerLotteryCrank(drawId);
}
