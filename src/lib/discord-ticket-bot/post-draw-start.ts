import type { Connection } from "@solana/web3.js";

import { fetchDrawById, fetchJackpotLamports } from "@/lib/lottery/chain";
import { lotteryProgramId } from "@/lib/lottery/config";
import { formatSolFromLamports } from "@/lib/lottery/draws";
import { getSiteUrl } from "@/lib/site-metadata";

import { drawStartBannerUrl } from "./banners";
import { discordTicketBotConfigured } from "./config";
import { postEmbedToChannel } from "./discord-channel";
import { resolveDiscordNotifyChannelIds } from "./notify-channels";
import {
  claimDiscordDrawEmbed,
  releaseDiscordDrawEmbedClaim,
} from "@/lib/lottery/discord-draw-embed-idempotency";

function formatCloseDate(salesCloseTs?: number): string | null {
  if (!salesCloseTs || !Number.isFinite(salesCloseTs)) return null;
  return new Date(salesCloseTs * 1000).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  });
}

function buildDrawStartEmbed(opts: {
  drawId: number;
  seedLamports?: number;
  salesCloseTs?: number;
}) {
  const lines = [`Draw **#${opts.drawId}** is now open for ticket sales.`];
  if (opts.seedLamports && opts.seedLamports > 0) {
    lines.push(`Seed jackpot: **${formatSolFromLamports(opts.seedLamports)} SOL**`);
  }
  const closeDate = formatCloseDate(opts.salesCloseTs);
  if (closeDate) lines.push(`Sales close **${closeDate}**`);

  return {
    title: `🎰 Slotto draw #${opts.drawId} is LIVE`,
    description: lines.join("\n"),
    color: 0xf5b942,
    image: { url: drawStartBannerUrl() },
    footer: { text: "slotto.gg · prize draw" },
    timestamp: new Date().toISOString(),
  };
}

export async function notifyDiscordDrawLive(
  connection: Connection,
  drawId: number,
  opts?: { seedLamports?: number; salesCloseTs?: number },
): Promise<{ posted: number; skipped: boolean; reason?: string }> {
  if (!discordTicketBotConfigured()) {
    return { posted: 0, skipped: true, reason: "Discord bot not configured" };
  }

  const channelIds = await resolveDiscordNotifyChannelIds();
  if (channelIds.length === 0) {
    return { posted: 0, skipped: true, reason: "no notify channels configured" };
  }

  const claimed = await claimDiscordDrawEmbed(drawId, "live");
  if (!claimed) {
    return { posted: 0, skipped: true, reason: "already posted" };
  }

  const programId = lotteryProgramId();
  const draw = await fetchDrawById(connection, programId, drawId);
  const salesCloseTs = opts?.salesCloseTs ?? draw?.salesCloseTs;
  let seedLamports = opts?.seedLamports;
  if (seedLamports == null && draw) {
    seedLamports = await fetchJackpotLamports(connection, draw.prizeVault);
  }

  const embed = buildDrawStartEmbed({
    drawId,
    seedLamports,
    salesCloseTs,
  });
  const siteUrl = getSiteUrl().replace(/\/$/, "") || "https://slotto.gg";

  let posted = 0;
  const failures: string[] = [];
  for (const channelId of channelIds) {
    try {
      await postEmbedToChannel(channelId, embed, siteUrl);
      posted += 1;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      failures.push(`${channelId}: ${msg}`);
      console.warn("[discord draw live]", channelId, e);
    }
  }

  if (posted === 0) {
    await releaseDiscordDrawEmbedClaim(drawId, "live");
    return {
      posted: 0,
      skipped: true,
      reason: failures.join("; ") || "post failed",
    };
  }

  return { posted, skipped: false };
}
