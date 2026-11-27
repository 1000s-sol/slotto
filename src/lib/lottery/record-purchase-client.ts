/** Fire-and-forget: persist paid-with mint after a confirmed buy. */
export async function recordTicketPurchaseClient(payload: {
  signature: string;
  wallet: string;
  drawId: number;
  count: number;
  payWith: string;
}): Promise<void> {
  try {
    await fetch("/api/lottery/record-purchase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    /* best-effort */
  }
}
