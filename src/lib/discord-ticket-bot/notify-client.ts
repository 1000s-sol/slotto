/** Fire-and-forget Discord ticket-sale notification after a successful buy. */
export async function notifyDiscordTicketSaleClient(payload: {
  signature: string;
  wallet: string;
  drawId: number;
  count: number;
  payWith: string;
  tokenSymbol: string;
  tokenName: string;
  tokenImageUrl: string | null;
}): Promise<void> {
  try {
    await fetch("/api/discord/ticket-sale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    /* best-effort */
  }
}
