import { NextResponse } from "next/server";

import { discordTicketBotInviteUrl } from "@/lib/discord-ticket-bot/config";

export const dynamic = "force-dynamic";

/** Public invite URL (Application ID is not secret; built server-side from AUTH_DISCORD_ID). */
export async function GET() {
  const url = discordTicketBotInviteUrl();
  if (!url) {
    return NextResponse.json(
      { error: "Discord bot not configured (AUTH_DISCORD_ID + DISCORD_BOT_TOKEN)" },
      { status: 503 },
    );
  }
  return NextResponse.json({ inviteUrl: url });
}
