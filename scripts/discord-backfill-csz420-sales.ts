/**
 * Re-post Discord ticket-sale embeds for CSZ420 (CannaSolz) buys that were
 * missed when relative token icon URLs caused Discord to reject the message.
 *
 * Usage:
 *   npx tsx scripts/discord-backfill-csz420-sales.ts [--dry-run] [--force]
 *
 * --force  clear prior DiscordTicketSaleNotify rows so failed/idempotent skips re-post
 * --dry-run list candidates only
 */
import "dotenv/config";

import { Connection } from "@solana/web3.js";

import { discordTicketBotConfigured } from "../src/lib/discord-ticket-bot/config";
import { notifyDiscordTicketSale } from "../src/lib/discord-ticket-bot/post-ticket-sale";
import { prisma } from "../src/lib/prisma";
import { resolveLotteryRpcUrl } from "../src/lib/lottery/rpc-url";

const TOKEN_SYMBOL = "CSZ420";
const TOKEN_NAME = "CannaSolz";
const TOKEN_IMAGE = "/project-images/cannasolz-token.png";

async function main() {
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has("--dry-run");
  const force = args.has("--force");

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

  const connection = new Connection(resolveLotteryRpcUrl(), "confirmed");
  let postedTotal = 0;
  let skipped = 0;
  let failed = 0;

  for (const p of cszBuys) {
    if (!force && notified.has(p.signature)) {
      skipped += 1;
      continue;
    }
    try {
      const result = await notifyDiscordTicketSale(connection, {
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
