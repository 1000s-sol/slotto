import type { Connection } from "@solana/web3.js";
import { PublicKey } from "@solana/web3.js";

import { fetchDrawById } from "@/lib/lottery/chain";
import { lotteryProgramId, solscanAccountUrl, solscanTxUrl } from "@/lib/lottery/config";
import { DrawState } from "@/lib/lottery/constants";
import {
  fetchSettledDrawPrizeLamports,
  formatSolFromLamports,
} from "@/lib/lottery/draws";
import { prisma } from "@/lib/prisma";
import { getSiteUrl } from "@/lib/site-metadata";
import { getSocialByWallets } from "@/lib/user-profile-db";

import { buyerLabelForWallet, shortWallet } from "./buyer-label";
import { discordTicketBotConfigured } from "./config";
import { mascotThumbnailUrl, postEmbedToChannel } from "./discord-channel";

function balanceDeltaForKey(
  keys: { staticAccountKeys: PublicKey[] },
  meta: { preBalances: number[]; postBalances: number[] },
  target: PublicKey,
): number | null {
  const idx = keys.staticAccountKeys.findIndex((k) => k.equals(target));
  if (idx < 0) return null;
  return meta.postBalances[idx] - meta.preBalances[idx];
}

async function fetchSettleTxSignature(
  connection: Connection,
  draw: NonNullable<Awaited<ReturnType<typeof fetchDrawById>>>,
): Promise<string | null> {
  if (!draw.winner) return null;
  const winnerPk = new PublicKey(draw.winner);
  const sigs = await connection.getSignaturesForAddress(draw.prizeVault, {
    limit: 40,
  });

  for (const { signature } of sigs) {
    const tx = await connection.getTransaction(signature, {
      maxSupportedTransactionVersion: 0,
    });
    if (!tx?.meta) continue;

    const keys = tx.transaction.message.getAccountKeys({
      accountKeysFromLookups: tx.meta.loadedAddresses,
    });
    const vaultDelta = balanceDeltaForKey(keys, tx.meta, draw.prizeVault);
    if (vaultDelta === null || vaultDelta >= 0) continue;

    const winnerDelta = balanceDeltaForKey(keys, tx.meta, winnerPk);
    if (winnerDelta !== null && winnerDelta > 0) return signature;
  }
  return null;
}

function winnerSocialLine(
  wallet: string,
  social: Awaited<ReturnType<typeof getSocialByWallets>>[string] | undefined,
): string | null {
  if (!social) return null;
  const parts: string[] = [];
  if (social.discord?.username) parts.push(`Discord: **${social.discord.username}**`);
  if (social.x?.username) {
    const handle = social.x.username.replace(/^@/, "");
    parts.push(`X: **@${handle}**`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

function buildDrawWinnerEmbed(opts: {
  drawId: number;
  winnerLabel: string;
  winnerWallet: string;
  winningTicketId: number;
  totalTickets: number;
  prizeSol: string;
  settleTx: string | null;
  socialLine: string | null;
}) {
  const ticketLine =
    opts.winningTicketId > 0
      ? `#${opts.winningTicketId} of ${opts.totalTickets.toLocaleString()}`
      : `${opts.totalTickets.toLocaleString()} tickets sold`;

  const embed: Record<string, unknown> = {
    title: `🏆 Slotto draw #${opts.drawId} — winner!`,
    description: [
      `Draw **#${opts.drawId}** has settled.`,
      opts.socialLine,
    ]
      .filter(Boolean)
      .join("\n"),
    color: 0x57f287,
    thumbnail: { url: mascotThumbnailUrl() },
    fields: [
      { name: "Winner", value: opts.winnerLabel, inline: true },
      { name: "Prize", value: `${opts.prizeSol} SOL`, inline: true },
      { name: "Winning ticket", value: ticketLine, inline: true },
      {
        name: "Wallet",
        value: `[${shortWallet(opts.winnerWallet)}](${solscanAccountUrl(opts.winnerWallet)})`,
        inline: false,
      },
    ],
    footer: { text: "slotto.gg · v2 prize draw" },
    timestamp: new Date().toISOString(),
  };

  if (opts.settleTx) {
    (embed.fields as Array<Record<string, unknown>>).push({
      name: "Settlement",
      value: `[View on Solscan](${solscanTxUrl(opts.settleTx)})`,
      inline: false,
    });
  }

  return embed;
}

export async function notifyDiscordDrawWinner(
  connection: Connection,
  drawId: number,
): Promise<{ posted: number; skipped: boolean; reason?: string }> {
  if (!discordTicketBotConfigured()) {
    return { posted: 0, skipped: true, reason: "Discord bot not configured" };
  }

  const programId = lotteryProgramId();
  const draw = await fetchDrawById(connection, programId, drawId);
  if (!draw) {
    return { posted: 0, skipped: true, reason: "draw not found" };
  }
  if (draw.state !== DrawState.Settled || !draw.winner) {
    return { posted: 0, skipped: true, reason: "draw not settled" };
  }

  const guilds = await prisma.discordTicketBotGuild.findMany({
    where: { enabled: true },
  });
  if (guilds.length === 0) {
    return { posted: 0, skipped: true, reason: "no guild channels configured" };
  }

  const [prizeLamports, winnerLabel, settleTx, socialMap] = await Promise.all([
    fetchSettledDrawPrizeLamports(connection, draw),
    buyerLabelForWallet(draw.winner),
    fetchSettleTxSignature(connection, draw),
    getSocialByWallets([draw.winner]),
  ]);

  const prizeSol = formatSolFromLamports(prizeLamports);
  const siteUrl = getSiteUrl().replace(/\/$/, "") || "https://slotto.gg";
  const embed = buildDrawWinnerEmbed({
    drawId,
    winnerLabel,
    winnerWallet: draw.winner,
    winningTicketId: draw.winningTicketId,
    totalTickets: draw.totalTickets,
    prizeSol,
    settleTx,
    socialLine: winnerSocialLine(draw.winner, socialMap[draw.winner]),
  });

  let posted = 0;
  const failures: string[] = [];

  for (const g of guilds) {
    try {
      await postEmbedToChannel(g.channelId, embed, siteUrl);
      posted += 1;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      failures.push(`${g.guildId}: ${msg}`);
      if (msg.includes("403") || msg.includes("404") || msg.includes("50001")) {
        await prisma.discordTicketBotGuild
          .update({
            where: { guildId: g.guildId },
            data: { enabled: false },
          })
          .catch(() => {});
      }
    }
  }

  if (failures.length > 0) {
    console.warn("[discord draw winner] partial post failures:", failures.join("; "));
  }

  return { posted, skipped: posted === 0 };
}
