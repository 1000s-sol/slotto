import { DEFAULT_UI_SELL_CAP } from "./spl-types";

/** displayCap was never set separately — still equals on-chain max (often 500). */
export function splDisplayCapLooksUnconfigured(
  displayCap: number,
  onChainCap: number,
): boolean {
  return displayCap === onChainCap && onChainCap > DEFAULT_UI_SELL_CAP;
}

/** Buy UI / Postgres display cap (defaults poisoned 500→500 rows to 60). */
export function normalizeSplDisplayCap(
  displayCap: number,
  onChainCap: number,
): number {
  const capped = Math.min(displayCap, onChainCap);
  if (splDisplayCapLooksUnconfigured(capped, onChainCap)) {
    return Math.min(DEFAULT_UI_SELL_CAP, onChainCap);
  }
  return capped;
}
