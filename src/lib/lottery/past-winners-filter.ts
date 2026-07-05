import { isProductionDrawVisible } from "./draw-display-db";

/** @deprecated Env min-id filter — prefer DB {@link isProductionDrawVisible}. */
export function pastWinnersMinDrawId(): number {
  const raw = process.env.LOTTERY_PAST_WINNERS_MIN_DRAW_ID?.trim();
  if (!raw) return 0;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** Whether a settled draw appears in past winners (production draws only). */
export async function isPastWinnerDrawVisible(drawId: number): Promise<boolean> {
  return isProductionDrawVisible(drawId);
}
