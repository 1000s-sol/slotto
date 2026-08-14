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

function playButtonRow(siteUrl: string) {
  return {
    type: 1,
    components: [
      {
        type: 2,
        style: 5,
        label: "Play at slotto.gg",
        url: siteUrl,
      },
    ],
  };
}

function resolveSiteUrl(siteUrl?: string): string {
  return (
    siteUrl?.replace(/\/$/, "") ||
    getSiteUrl().replace(/\/$/, "") ||
    "https://slotto.gg"
  );
}

export async function postEmbedToChannel(
  channelId: string,
  embed: Record<string, unknown>,
  siteUrl?: string,
): Promise<void> {
  const url = resolveSiteUrl(siteUrl);
  const res = await discordApi(`/channels/${channelId}/messages`, {
    method: "POST",
    body: JSON.stringify({
      embeds: [embed],
      components: [playButtonRow(url)],
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Discord POST ${res.status}: ${text.slice(0, 200)}`);
  }
}

export type DiscordEmbedFile = {
  filename: string;
  bytes: Uint8Array;
  mime: string;
};

/** Upload files with the message so Discord hosts them (URL embeds often drop GIFs). */
export async function postEmbedToChannelWithFiles(
  channelId: string,
  embed: Record<string, unknown>,
  files: DiscordEmbedFile[],
  siteUrl?: string,
): Promise<void> {
  if (files.length === 0) {
    await postEmbedToChannel(channelId, embed, siteUrl);
    return;
  }

  const token = discordTicketBotToken();
  if (!token) throw new Error("Discord ticket bot token not configured");

  const url = resolveSiteUrl(siteUrl);
  const embedWithFiles: Record<string, unknown> = { ...embed };
  const first = files[0]!;
  embedWithFiles.image = { url: `attachment://${first.filename}` };

  const form = new FormData();
  form.append(
    "payload_json",
    JSON.stringify({
      embeds: [embedWithFiles],
      components: [playButtonRow(url)],
    }),
  );
  files.forEach((file, i) => {
    const copy = new ArrayBuffer(file.bytes.byteLength);
    new Uint8Array(copy).set(file.bytes);
    form.append(
      `files[${i}]`,
      new Blob([copy], { type: file.mime }),
      file.filename,
    );
  });

  const res = await fetch(
    `https://discord.com/api/v10/channels/${channelId}/messages`,
    {
      method: "POST",
      headers: { Authorization: `Bot ${token}` },
      body: form,
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Discord POST ${res.status}: ${text.slice(0, 200)}`);
  }
}
