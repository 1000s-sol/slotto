/**
 * Whether visitors may invoke the public `triggerLotteryCrank` server action.
 * When false, only authenticated cron (`/api/lottery/crank` + CRON_SECRET) may crank.
 */
export function allowPublicLotteryCrank(): boolean {
  const raw = process.env.LOTTERY_PUBLIC_CRANK_ENABLED?.trim().toLowerCase();
  if (raw === "true" || raw === "1" || raw === "yes") return true;
  if (raw === "false" || raw === "0" || raw === "no") return false;

  if (process.env.NODE_ENV === "production") {
    const hasCron = !!(
      process.env.CRON_SECRET?.trim() ||
      process.env.LOTTERY_CRON_SECRET?.trim()
    );
    return !hasCron;
  }

  return true;
}
