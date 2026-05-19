/** Ask the server keeper to advance a draw (no-op if already terminal). */
export async function triggerLotteryCrank(drawId: number): Promise<void> {
  try {
    await fetch(`/api/lottery/crank?drawId=${drawId}`, {
      method: "POST",
      cache: "no-store",
    });
  } catch {
    /* keeper may be offline locally; cron or manual settle still works */
  }
}
