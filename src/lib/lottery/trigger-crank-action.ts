"use server";

import { runTriggerLotteryCrank } from "./trigger-lottery-crank-impl";

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
  return runTriggerLotteryCrank(drawId);
}
