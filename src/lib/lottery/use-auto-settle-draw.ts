import type { LotteryDrawView } from "./chain";
import type { CrankUiResult } from "./trigger-crank-action";

/**
 * When the countdown hits zero, drive settlement via the server keeper until
 * the draw reaches Settled or Refunded (no wallet popups).
 *
 * DISABLED: concurrent homepage/preview auto-settle was racing admin Settle and
 * wiping VrfRequested mid-flight (draw #20 RequestVrf → ResetVrf loop). Use the
 * admin Settle button only until Switchboard settle is stable again.
 */
export function useAutoSettleDraw(
  _draw: LotteryDrawView | null,
  _nowSec: number | null,
  _refresh: () => Promise<void>,
  _onCrankResult?: (result: CrankUiResult) => void,
): void {
  // no-op
}
