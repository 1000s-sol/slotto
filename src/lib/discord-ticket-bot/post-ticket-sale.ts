import type { Connection } from "@solana/web3.js";
import { PublicKey } from "@solana/web3.js";

import { fetchDrawById, fetchJackpotLamports } from "@/lib/lottery/chain";
import { lotteryProgramId, solscanTxUrl } from "@/lib/lottery/config";
import { formatSolFromLamports } from "@/lib/lottery/draws";
import { prisma } from "@/lib/prisma";
import { getSiteUrl } from "@/lib/site-metadata";

import { buyerLabelForWallet } from "./buyer-label";
import { discordTicketBotToken } from "./config";
import { verifyLotteryBuySignature } from "./verify-buy-tx";
import { recordLotteryTicketPurchase } from "@/lib/lottery/draw-paid-with-db";

const WRAPPED_SOL_MINT = "So11111111111111111111111111111111111111112";

export type TicketSaleNotifyInput = {
  signature: string;
  wallet: string;
  drawId: number;
  count: number;
  /** `SOL` or SPL mint base58 */
  payWith: string;
  tokenSymbol: string;
  tokenName: string;
  tokenImageUrl: string | null;
};

async function discordApi(
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

function mascotThumbnailUrl(): string {
  return `${getSiteUrl().replace(/\/$/, "")}/brand/slotto-guy.png`;
}

function buildTicketSaleEmbed(opts: {
  buyerLabel: string;
  count: number;
  tokenSymbol: string;
  tokenName: string;
  tokenImageUrl: string | null;
  jackpotSol: string | null;
  drawId: number;
  signature: string;
}) {
  const ticketWord = opts.count === 1 ? "ticket" : "tickets";
  const embed: Record<string, unknown> = {
    title: "🎟️ New Slotto ticket purchase",
    description: `Someone just bought **${opts.count}** ${ticketWord} in draw **#${opts.drawId}**.`,
    color: 0xf5b942,
    thumbnail: { url: mascotThumbnailUrl() },
    author: {
      name: `${opts.tokenSymbol} · ${opts.tokenName}`,
      ...(opts.tokenImageUrl ? { icon_url: opts.tokenImageUrl } : {}),
    },
    fields: [
      { name: "Buyer", value: opts.buyerLabel, inline: true },
      { name: "Tickets", value: String(opts.count), inline: true },
      {
        name: "Paid with",
        value: `${opts.tokenSymbol} (${opts.tokenName})`,
        inline: true,
      },
      {
        name: "Live jackpot",
        value: opts.jackpotSol ? `${opts.jackpotSol} SOL` : "—",
        inline: true,
      },
      {
        name: "Transaction",
        value: `[View on Solscan](${solscanTxUrl(opts.signature)})`,
        inline: false,
      },
    ],
    timestamp: new Date().toISOString(),
  };
  return embed;
}

async function postEmbedToChannel(
  channelId: string,
  embed: ReturnType<typeof buildTicketSaleEmbed>,
  siteUrl: string,
): Promise<void> {
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
              url: siteUrl,
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

export async function notifyDiscordTicketSale(
  connection: Connection,
  input: TicketSaleNotifyInput,
): Promise<{ posted: number; skipped: boolean }> {
  const signature = input.signature.trim();
  const wallet = input.wallet.trim();
  if (!signature || !wallet) {
    throw new Error("signature and wallet required");
  }
  if (!Number.isInteger(input.count) || input.count < 1) {
    throw new Error("invalid count");
  }

  const existing = await prisma.discordTicketSaleNotify.findUnique({
    where: { signature },
  });
  if (existing) return { posted: 0, skipped: true };

  const programId = lotteryProgramId();
  const ok = await verifyLotteryBuySignature(
    connection,
    signature,
    programId,
    wallet,
  );
  if (!ok) {
    throw new Error("Transaction not verified as a confirmed ticket purchase");
  }

  try {
    await recordLotteryTicketPurchase({
      signature,
      wallet,
      drawNumber: input.drawId,
      count: input.count,
      payWith: input.payWith,
    });
  } catch (e) {
    console.warn(
      "[discord ticket sale] paid-with DB record skipped:",
      e instanceof Error ? e.message : e,
    );
  }

  const guilds = await prisma.discordTicketBotGuild.findMany({
    where: { enabled: true },
  });
  if (guilds.length === 0) {
    await prisma.discordTicketSaleNotify.create({
      data: { signature, drawId: input.drawId },
    });
    return { posted: 0, skipped: false };
  }

  const draw = await fetchDrawById(connection, programId, input.drawId);
  let jackpotSol: string | null = null;
  if (draw) {
    const lamports = await fetchJackpotLamports(connection, draw.prizeVault);
    jackpotSol = formatSolFromLamports(lamports);
  }

  const buyerLabel = await buyerLabelForWallet(wallet);
  const siteUrl = getSiteUrl().replace(/\/$/, "") || "https://slotto.gg";
  const embed = buildTicketSaleEmbed({
    buyerLabel,
    count: input.count,
    tokenSymbol:
      input.tokenSymbol || (input.payWith === "SOL" ? "SOL" : "SPL"),
    tokenName: input.tokenName || input.tokenSymbol || "Token",
    tokenImageUrl: input.tokenImageUrl,
    jackpotSol,
    drawId: input.drawId,
    signature,
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

  await prisma.discordTicketSaleNotify.create({
    data: { signature, drawId: input.drawId },
  });

  if (failures.length > 0) {
    console.warn("[discord ticket bot] partial post failures:", failures.join("; "));
  }

  return { posted, skipped: false };
}

export function normalizePayWith(payWith: string): string {
  if (payWith === "SOL" || payWith === WRAPPED_SOL_MINT) return "SOL";
  return payWith;
}
