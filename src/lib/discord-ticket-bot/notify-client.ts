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
    const res = await fetch("/api/discord/ticket-sale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn(
        "[discord ticket-sale client]",
        res.status,
        text.slice(0, 200),
      );
    }
  } catch (e) {
    console.warn(
      "[discord ticket-sale client]",
      e instanceof Error ? e.message : e,
    );
  }
}
