/**
 * Whether open visitors may invoke settlement via the homepage server action.
 * Defaults to **on** so the UI timer triggers crank when sales close (throttled
 * per draw in `runTriggerLotteryCrank`). GitHub cron remains backup when nobody
 * has the site open. Set `LOTTERY_UI_CRANK_ENABLED=false` to disable.
 */
export function allowUiSettlementCrank(): boolean {
  const raw = process.env.LOTTERY_UI_CRANK_ENABLED?.trim().toLowerCase();
  if (raw === "false" || raw === "0" || raw === "no") return false;
  return true;
}

/** @deprecated Use {@link allowUiSettlementCrank}. Kept for older env names. */
export function allowPublicLotteryCrank(): boolean {
  const legacy = process.env.LOTTERY_PUBLIC_CRANK_ENABLED?.trim().toLowerCase();
  if (legacy === "false" || legacy === "0" || legacy === "no") return false;
  if (legacy === "true" || legacy === "1" || legacy === "yes") return true;
  return allowUiSettlementCrank();
}
