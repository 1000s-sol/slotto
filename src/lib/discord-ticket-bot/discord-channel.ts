import { getSiteUrl } from "@/lib/site-metadata";

import { discordTicketBotToken } from "./config";

export async function discordApi(
  path: string,
  init: RequestInit,
): Promise<Response> {
  const token = discordTicketBotToken();
  if (!token) throw new Error("Discord ticket bot token not configured");
  return fetch(`https://discord.com/api/v10${path}`, {
    ...init,
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
      ...(init.headers as Record<string, string> | undefined),
    },
  });
}

export function mascotThumbnailUrl(): string {
  return `${getSiteUrl().replace(/\/$/, "")}/brand/slotto-guy.png`;
}

export async function postEmbedToChannel(
  channelId: string,
  embed: Record<string, unknown>,
  siteUrl?: string,
): Promise<void> {
  const url = siteUrl?.replace(/\/$/, "") || getSiteUrl().replace(/\/$/, "") || "https://slotto.gg";
  const res = await discordApi(`/channels/${channelId}/messages`, {
    method: "POST",
    body: JSON.stringify({
      embeds: [embed],
      components: [
        {
          type: 1,
          components: [
            {
              type: 2,
              style: 5,
              label: "Play at slotto.gg",
              url,
            },
          ],
        },
      ],
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Discord POST ${res.status}: ${text.slice(0, 200)}`);
  }
}
