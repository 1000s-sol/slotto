import type { LotteryDrawView } from "./chain";
import { DrawState } from "./constants";

/** True when permissionless close → vrf → settle should run. */
export function drawNeedsSettlement(
  draw: LotteryDrawView,
  nowSec: number | null,
): boolean {
  if (drawTerminalState(draw)) return false;
  if (nowSec === null) return false;
  if (
    draw.state === DrawState.SalesClosed ||
    draw.state === DrawState.VrfRequested
  ) {
    return true;
  }
  return (
    draw.state === DrawState.Selling && nowSec >= draw.salesCloseTs
  );
}

export function drawTerminalState(draw: LotteryDrawView): boolean {
  return draw.state === DrawState.Settled || draw.state === DrawState.Refunded;
}
