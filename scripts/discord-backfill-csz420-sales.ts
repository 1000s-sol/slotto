/**
 * Re-post Discord ticket-sale embeds for CSZ420 (CannaSolz) buys that were
 * missed when relative token icon URLs caused Discord to reject the message.
 *
 * Usage:
 *   npx tsx scripts/discord-backfill-csz420-sales.ts [--dry-run] [--force] [--from-db]
 *
 * --force    clear prior DiscordTicketSaleNotify rows so failed/idempotent skips re-post
 * --dry-run  list candidates only
 * --from-db  skip on-chain verify (purchases already in LotteryTicketPurchase)
 */
import "dotenv/config";

import { Connection } from "@solana/web3.js";

import { buyerLabelForWallet } from "../src/lib/discord-ticket-bot/buyer-label";
import { ticketSaleBannerUrl } from "../src/lib/discord-ticket-bot/banners";
import { discordTicketBotConfigured } from "../src/lib/discord-ticket-bot/config";
import {
  mascotThumbnailUrl,
  postEmbedToChannel,
} from "../src/lib/discord-ticket-bot/discord-channel";
import { resolveDiscordNotifyChannelIds } from "../src/lib/discord-ticket-bot/notify-channels";
import { notifyDiscordTicketSale } from "../src/lib/discord-ticket-bot/post-ticket-sale";
import { formatDrawLabelForId } from "../src/lib/lottery/draw-display-db";
import { solscanTxUrl } from "../src/lib/lottery/config";
import { resolveLotteryRpcUrl } from "../src/lib/lottery/rpc-url";
import { prisma } from "../src/lib/prisma";
import { getSiteUrl } from "../src/lib/site-metadata";

const TOKEN_SYMBOL = "CSZ420";
const TOKEN_NAME = "CannaSolz";
const TOKEN_IMAGE = "/project-images/cannasolz-token.png";

function discordSiteBase(): string {
  const raw = getSiteUrl().replace(/\/$/, "") || "https://www.slotto.gg";
  try {
    const u = new URL(raw.includes("://") ? raw : `https://${raw}`);
    if (u.hostname === "slotto.gg") u.hostname = "www.slotto.gg";
    return u.origin;
  } catch {
    return "https://www.slotto.gg";
  }
}

function absImage(raw: string | null | undefined, siteUrl: string): string | null {
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
  if (v.startsWith("/") && !v.startsWith("//")) return `${siteUrl}${v}`;
  return null;
}

async function postFromDbPurchase(opts: {
  signature: string;
  wallet: string;
  drawId: number;
  count: number;
  tokenName: string;
  tokenImageUrl: string;
}): Promise<number> {
  const existing = await prisma.discordTicketSaleNotify.findUnique({
    where: { signature: opts.signature },
  });
  if (existing) return 0;

  const channelIds = await resolveDiscordNotifyChannelIds({
    onChainDrawId: opts.drawId,
  });
  if (channelIds.length === 0) {
    await prisma.discordTicketSaleNotify.create({
      data: { signature: opts.signature, drawId: opts.drawId },
    });
    return 0;
  }

  const siteUrl = discordSiteBase();
  const buyerLabel = await buyerLabelForWallet(opts.wallet);
  const drawLabel = await formatDrawLabelForId(opts.drawId);
  const paidWith = `${TOKEN_SYMBOL} (${opts.tokenName})`;
  const tokenIcon = absImage(opts.tokenImageUrl, siteUrl);
  const bannerUrl = absImage(
    ticketSaleBannerUrl(TOKEN_SYMBOL) ?? opts.tokenImageUrl,
    siteUrl,
  );

  const embedFull: Record<string, unknown> = {
    title: "🎟️ New Slotto ticket purchase",
    description: `Someone just bought **${opts.count}** ${opts.count === 1 ? "ticket" : "tickets"} in draw **${drawLabel}**.`,
    color: 0xf5b942,
    thumbnail: { url: mascotThumbnailUrl() },
    ...(bannerUrl ? { image: { url: bannerUrl } } : {}),
    author: {
      name: paidWith,
      ...(tokenIcon ? { icon_url: tokenIcon } : {}),
    },
    fields: [
      { name: "Buyer", value: buyerLabel, inline: true },
      { name: "Tickets", value: String(opts.count), inline: true },
      { name: "Paid with", value: paidWith, inline: true },
      { name: "Live jackpot", value: "—", inline: true },
      {
        name: "Transaction",
        value: `[View on Solscan](${solscanTxUrl(opts.signature)})`,
        inline: false,
      },
    ],
    timestamp: new Date().toISOString(),
  };

  const embedPlain: Record<string, unknown> = {
    title: embedFull.title,
    description: embedFull.description,
    color: embedFull.color,
    thumbnail: embedFull.thumbnail,
    author: { name: paidWith },
    fields: embedFull.fields,
    timestamp: embedFull.timestamp,
  };

  let posted = 0;
  for (const channelId of channelIds) {
    try {
      try {
        await postEmbedToChannel(channelId, embedFull, siteUrl);
      } catch {
        await postEmbedToChannel(channelId, embedPlain, siteUrl);
      }
      posted += 1;
    } catch (e) {
      console.warn(
        `    channel ${channelId}:`,
        e instanceof Error ? e.message : e,
      );
    }
  }

  if (posted > 0) {
    await prisma.discordTicketSaleNotify.create({
      data: { signature: opts.signature, drawId: opts.drawId },
    });
  }
  return posted;
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has("--dry-run");
  const force = args.has("--force");
  const fromDb = args.has("--from-db");

  if (!discordTicketBotConfigured()) {
    console.error("Discord ticket bot not configured (missing token).");
    process.exit(1);
  }

  const project = await prisma.project.findFirst({
    where: {
      OR: [
        { slug: "cannasolz" },
        { tokenName: { equals: TOKEN_SYMBOL, mode: "insensitive" } },
        { tokenName: { contains: "CannaSolz", mode: "insensitive" } },
      ],
    },
    select: {
      slug: true,
      name: true,
      tokenMint: true,
      tokenName: true,
      tokenImageUrl: true,
    },
  });

  const mint = project?.tokenMint?.trim();
  if (!mint) {
    console.error("Could not resolve CSZ420 / CannaSolz tokenMint from Project.");
    process.exit(1);
  }

  const tokenImageUrl =
    project?.tokenImageUrl?.trim() || TOKEN_IMAGE;
  const tokenName =
    project?.name?.trim() || project?.tokenName?.trim() || TOKEN_NAME;

  console.info(
    `CSZ420 mint=${mint} project=${project?.slug ?? "?"} image=${tokenImageUrl}`,
  );

  // Json filters are awkward across providers — load recent rows and filter in JS.
  const purchases = await prisma.lotteryTicketPurchase.findMany({
    orderBy: { createdAt: "desc" },
    take: 2000,
    include: {
      draw: { select: { drawNumber: true, id: true } },
    },
  });

  const cszBuys = purchases
    .filter((p) => {
      const raw = p.paidWithMints;
      return (
        Array.isArray(raw) &&
        raw.some((m) => typeof m === "string" && m === mint)
      );
    })
    .reverse();

  console.info(
    `Found ${cszBuys.length} CSZ420 purchase(s) in last ${purchases.length} buys`,
  );

  const sigs = cszBuys.map((p) => p.signature);
  const existingNotifies = await prisma.discordTicketSaleNotify.findMany({
    where: { signature: { in: sigs } },
  });
  const notified = new Set(existingNotifies.map((n) => n.signature));

  for (const p of cszBuys) {
    const onChainDrawId = p.draw.drawNumber;
    const already = notified.has(p.signature);
    console.info(
      `  ${p.signature.slice(0, 8)}… draw#${onChainDrawId} tickets=${p.tickets} wallet=${p.wallet.slice(0, 6)}… notify=${already ? "yes" : "NO"}`,
    );
  }

  if (dryRun) {
    console.info("Dry run — no posts.");
    return;
  }

  if (force && notified.size > 0) {
    const del = await prisma.discordTicketSaleNotify.deleteMany({
      where: { signature: { in: [...notified] } },
    });
    console.info(`Cleared ${del.count} prior DiscordTicketSaleNotify row(s)`);
  }

  const connection = fromDb
    ? null
    : new Connection(resolveLotteryRpcUrl(), "confirmed");
  let postedTotal = 0;
  let skipped = 0;
  let failed = 0;

  for (const p of cszBuys) {
    if (!force && notified.has(p.signature)) {
      skipped += 1;
      continue;
    }
    try {
      if (fromDb) {
        const posted = await postFromDbPurchase({
          signature: p.signature,
          wallet: p.wallet,
          drawId: p.draw.drawNumber,
          count: p.tickets,
          tokenName,
          tokenImageUrl,
        });
        if (posted === 0) {
          skipped += 1;
          console.info(`  skip ${p.signature.slice(0, 8)}…`);
        } else {
          postedTotal += posted;
          console.info(
            `  posted ${p.signature.slice(0, 8)}… → ${posted} channel(s)`,
          );
        }
      } else {
        const result = await notifyDiscordTicketSale(connection!, {
          signature: p.signature,
          wallet: p.wallet,
          drawId: p.draw.drawNumber,
          count: p.tickets,
          payWith: mint,
          tokenSymbol: TOKEN_SYMBOL,
          tokenName,
          tokenImageUrl,
        });
        if (result.skipped) {
          skipped += 1;
          console.info(`  skip ${p.signature.slice(0, 8)}… (idempotent)`);
        } else {
          postedTotal += result.posted;
          console.info(
            `  posted ${p.signature.slice(0, 8)}… → ${result.posted} channel(s)`,
          );
        }
      }
      await new Promise((r) => setTimeout(r, 1500));
    } catch (e) {
      failed += 1;
      console.error(
        `  FAIL ${p.signature.slice(0, 8)}…`,
        e instanceof Error ? e.message : e,
      );
    }
  }

  console.info(
    `Done. postedChannels=${postedTotal} skipped=${skipped} failed=${failed}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
