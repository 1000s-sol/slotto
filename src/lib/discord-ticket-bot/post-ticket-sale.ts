import type { Connection } from "@solana/web3.js";
import { PublicKey } from "@solana/web3.js";

import { fetchDrawById, fetchJackpotLamports } from "@/lib/lottery/chain";
import { lotteryProgramId, solscanTxUrl } from "@/lib/lottery/config";
import { formatSolFromLamports } from "@/lib/lottery/draws";
import { prisma } from "@/lib/prisma";
import { getSiteUrl } from "@/lib/site-metadata";

import { buyerLabelForWallet } from "./buyer-label";
import { ticketSaleBannerUrl, ticketSaleTickerForPayWith } from "./banners";
import { mascotThumbnailUrl, postEmbedToChannel } from "./discord-channel";
import { resolveDiscordNotifyChannelIds } from "./notify-channels";
import { verifyLotteryBuySignature } from "./verify-buy-tx";
import { formatDrawLabelForId } from "@/lib/lottery/draw-display-db";
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

function paidWithLabel(tokenSymbol: string, tokenName: string): string {
  const sym = tokenSymbol.trim() || "Token";
  const proj = tokenName.trim();
  if (proj && proj !== sym) return `${sym} (${proj})`;
  return sym;
}

/** Prefer www — Discord embed crawlers often fail on apex→www 308s. */
function discordSiteBase(siteUrl?: string): string {
  const raw = (siteUrl ?? getSiteUrl()).replace(/\/$/, "") || "https://www.slotto.gg";
  try {
    const u = new URL(raw.includes("://") ? raw : `https://${raw}`);
    if (u.hostname === "slotto.gg") u.hostname = "www.slotto.gg";
    return u.origin;
  } catch {
    return "https://www.slotto.gg";
  }
}

/** Discord rejects relative image URLs; prefer https absolute (www host). */
function discordImageUrl(raw: string | null | undefined, siteUrl: string): string | null {
  const v = raw?.trim();
  if (!v) return null;
  if (v.startsWith("https://") || v.startsWith("http://")) {
    try {
      const u = new URL(v);
      if (u.hostname === "slotto.gg") u.hostname = "www.slotto.gg";
      return u.toString();
    } catch {
      return null;
    }
  }
  if (v.startsWith("/") && !v.startsWith("//")) {
    return `${discordSiteBase(siteUrl)}${v}`;
  }
  return null;
}

function buildTicketSaleEmbed(
  opts: {
    buyerLabel: string;
    count: number;
    tokenSymbol: string;
    tokenName: string;
    tokenImageUrl: string | null;
    payWith: string;
    jackpotSol: string | null;
    drawLabel: string;
    signature: string;
  },
  siteUrl: string,
  media: "full" | "none" = "full",
) {
  const ticketWord = opts.count === 1 ? "ticket" : "tickets";
  const paidWith = paidWithLabel(opts.tokenSymbol, opts.tokenName);
  const tokenIcon = discordImageUrl(opts.tokenImageUrl, siteUrl);
  const bannerUrl =
    media === "full"
      ? discordImageUrl(
          ticketSaleBannerUrl(opts.tokenSymbol, opts.payWith) ??
            opts.tokenImageUrl,
          siteUrl,
        )
      : null;
  const embed: Record<string, unknown> = {
    title: "🎟️ New Slotto ticket purchase",
    description: `Someone just bought **${opts.count}** ${ticketWord} in draw **${opts.drawLabel}**.`,
    color: 0xf5b942,
    // Omit media entirely on plain retry — Discord rejects the whole message
    // if any embed image URL fails (including the mascot thumbnail).
    ...(media === "full" ? { thumbnail: { url: mascotThumbnailUrl() } } : {}),
    ...(bannerUrl ? { image: { url: bannerUrl } } : {}),
    author: {
      name: paidWith,
      ...(media === "full" && tokenIcon ? { icon_url: tokenIcon } : {}),
    },
    fields: [
      { name: "Buyer", value: opts.buyerLabel, inline: true },
      { name: "Tickets", value: String(opts.count), inline: true },
      {
        name: "Paid with",
        value: paidWith,
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
  const alreadyRecorded = await prisma.lotteryTicketPurchase.findUnique({
    where: { signature },
    select: { id: true },
  });

  // Prefer on-chain verify; if RPC flakes but we already persisted the buy, still notify.
  let ok = false;
  try {
    ok = await verifyLotteryBuySignature(
      connection,
      signature,
      programId,
      wallet,
    );
  } catch (e) {
    console.warn(
      "[discord ticket sale] verify RPC error:",
      e instanceof Error ? e.message : e,
    );
  }
  if (!ok && !alreadyRecorded) {
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

  const channelIds = await resolveDiscordNotifyChannelIds({
    onChainDrawId: input.drawId,
  });
  if (channelIds.length === 0) {
    await prisma.discordTicketSaleNotify.create({
      data: { signature, drawId: input.drawId },
    });
    return { posted: 0, skipped: false };
  }

  let jackpotSol: string | null = null;
  try {
    const draw = await fetchDrawById(connection, programId, input.drawId);
    if (draw) {
      const lamports = await fetchJackpotLamports(connection, draw.prizeVault);
      jackpotSol = formatSolFromLamports(lamports);
    }
  } catch (e) {
    console.warn(
      "[discord ticket sale] jackpot lookup skipped:",
      e instanceof Error ? e.message : e,
    );
  }

  const buyerLabel = await buyerLabelForWallet(wallet);
  const siteUrl = discordSiteBase();
  const drawLabel = await formatDrawLabelForId(input.drawId);
  // Only remap ticker when this buy's mint is a known banner mint (never by label heuristics).
  const tokenSymbol =
    ticketSaleTickerForPayWith(input.payWith) ||
    input.tokenSymbol ||
    (input.payWith === "SOL" ? "SOL" : "SPL");
  const embedOpts = {
    buyerLabel,
    count: input.count,
    tokenSymbol,
    tokenName: input.tokenName || input.tokenSymbol || "Token",
    tokenImageUrl: input.tokenImageUrl,
    payWith: input.payWith,
    jackpotSol,
    drawLabel,
    signature,
  };
  const embed = buildTicketSaleEmbed(embedOpts, siteUrl, "full");
  const embedPlain = buildTicketSaleEmbed(embedOpts, siteUrl, "none");

  let posted = 0;
  const failures: string[] = [];

  for (const channelId of channelIds) {
    try {
      try {
        await postEmbedToChannel(channelId, embed, siteUrl);
      } catch (first) {
        // Relative/broken image URLs (common for non-liquid project logos) make
        // Discord reject the whole message — retry text-only so the sale still posts.
        console.warn(
          "[discord ticket bot] embed media failed, retrying plain:",
          first instanceof Error ? first.message : first,
        );
        await postEmbedToChannel(channelId, embedPlain, siteUrl);
      }
      posted += 1;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      failures.push(`${channelId}: ${msg}`);
    }
  }

  // Only mark notified when at least one channel got the message (or none configured).
  // Failed posts must remain retryable for the same signature.
  if (posted > 0) {
    await prisma.discordTicketSaleNotify.create({
      data: { signature, drawId: input.drawId },
    });
  }

  if (failures.length > 0) {
    console.warn("[discord ticket bot] partial post failures:", failures.join("; "));
  }

  if (posted === 0 && failures.length > 0) {
    throw new Error(`Discord post failed: ${failures.join("; ")}`);
  }

  return { posted, skipped: false };
}

export function normalizePayWith(payWith: string): string {
  if (payWith === "SOL" || payWith === WRAPPED_SOL_MINT) return "SOL";
  return payWith;
}
