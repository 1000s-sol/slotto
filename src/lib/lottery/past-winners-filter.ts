/** Minimum draw id shown in the homepage past winners table (0 = show all). */
export function pastWinnersMinDrawId(): number {
  const raw = process.env.LOTTERY_PAST_WINNERS_MIN_DRAW_ID?.trim();
  if (!raw) return 0;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function isPastWinnerDrawVisible(drawId: number): boolean {
  return drawId >= pastWinnersMinDrawId();
}
