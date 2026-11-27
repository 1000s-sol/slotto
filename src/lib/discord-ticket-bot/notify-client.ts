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
  const attempt = async (): Promise<boolean> => {
    const res = await fetch("/api/discord/ticket-sale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      // Keep the request alive across navigation / success-modal paint.
      keepalive: true,
    });
    if (res.ok) return true;
    const text = await res.text().catch(() => "");
    console.warn(
      "[discord ticket-sale client]",
      res.status,
      text.slice(0, 200),
    );
    return false;
  };

  try {
    if (await attempt()) return;
    await new Promise((r) => setTimeout(r, 2000));
    if (await attempt()) return;
    await new Promise((r) => setTimeout(r, 4000));
    await attempt();
  } catch (e) {
    console.warn(
      "[discord ticket-sale client]",
      e instanceof Error ? e.message : e,
    );
  }
}
