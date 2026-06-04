/** Discord bot for ticket-sale embeds in community servers. */

/** View Channel (1024) + Send Messages (2048) + Embed Links (16384) */
export const DISCORD_TICKET_BOT_PERMISSIONS = "19456";

export function discordTicketBotClientId(): string | undefined {
  return (
    process.env.DISCORD_TICKET_BOT_CLIENT_ID?.trim() ||
    process.env.NEXT_PUBLIC_DISCORD_TICKET_BOT_CLIENT_ID?.trim() ||
    process.env.AUTH_DISCORD_ID?.trim() ||
    process.env.DISCORD_APPLICATION_ID?.trim()
  );
}

export function discordTicketBotToken(): string | undefined {
  return (
    process.env.DISCORD_TICKET_BOT_TOKEN?.trim() ||
    process.env.DISCORD_BOT_TOKEN?.trim()
  );
}

export function discordTicketBotPublicKey(): string | undefined {
  return process.env.DISCORD_TICKET_BOT_PUBLIC_KEY?.trim();
}

export function discordTicketBotConfigured(): boolean {
  return Boolean(discordTicketBotClientId() && discordTicketBotToken());
}

export function discordTicketBotInviteUrl(clientId?: string): string | null {
  const id = clientId ?? discordTicketBotClientId();
  if (!id) return null;
  const params = new URLSearchParams({
    client_id: id,
    permissions: DISCORD_TICKET_BOT_PERMISSIONS,
    scope: "bot applications.commands",
  });
  return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
}

export function discordInteractionsConfigured(): boolean {
  return Boolean(
    discordTicketBotConfigured() && discordTicketBotPublicKey(),
  );
}
