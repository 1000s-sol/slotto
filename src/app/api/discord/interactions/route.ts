import {
  discordInteractionsConfigured,
} from "@/lib/discord-ticket-bot/config";
import { handleDiscordTicketBotInteraction } from "@/lib/discord-ticket-bot/interactions";
import { verifyDiscordInteractionRequest } from "@/lib/discord-ticket-bot/verify-interaction";

export const dynamic = "force-dynamic";

/** Discord slash-command interactions (`/slotto-setup`). */
export async function POST(request: Request) {
  if (!discordInteractionsConfigured()) {
    return new Response("Discord interactions not configured", { status: 503 });
  }

  const signature = request.headers.get("X-Signature-Ed25519");
  const timestamp = request.headers.get("X-Signature-Timestamp");
  const rawBody = await request.text();

  if (!verifyDiscordInteractionRequest(rawBody, signature, timestamp)) {
    return new Response("Invalid request signature", { status: 401 });
  }

  return handleDiscordTicketBotInteraction(rawBody);
}
