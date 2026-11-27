/**
 * Post a Discord ticket-sale embed for a known buy signature (missed client notify).
 *
 * Usage:
 *   npx tsx scripts/discord-backfill-sale-by-sig.ts \
 *     --sig <tx> --wallet <buyer> --draw <id> --count <n> \
 *     --pay <mint|SOL> [--symbol EMPIRE] [--name "Omerta"] [--image <url>]
 */
import "dotenv/config";

import { Connection } from "@solana/web3.js";

import { discordTicketBotConfigured } from "../src/lib/discord-ticket-bot/config";
import { notifyDiscordTicketSale } from "../src/lib/discord-ticket-bot/post-ticket-sale";
import { resolveLotteryRpcUrl } from "../src/lib/lottery/rpc-url";
import { prisma } from "../src/lib/prisma";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0) return undefined;
  return process.argv[i + 1];
}

async function main() {
  if (!discordTicketBotConfigured()) {
    console.error("Discord bot not configured");
    process.exit(1);
  }

  const signature = arg("sig")?.trim();
  const wallet = arg("wallet")?.trim();
  const drawId = parseInt(arg("draw") ?? "", 10);
  const count = parseInt(arg("count") ?? "1", 10);
  const payWith = arg("pay")?.trim() || "SOL";
  const tokenSymbol = arg("symbol")?.trim() || (payWith === "SOL" ? "SOL" : "SPL");
  const tokenName = arg("name")?.trim() || tokenSymbol;
  const tokenImageUrl = arg("image")?.trim() || null;
  const force = process.argv.includes("--force");

  if (!signature || !wallet || !Number.isFinite(drawId) || count < 1) {
    console.error(
      "Usage: --sig --wallet --draw --count --pay [--symbol] [--name] [--image] [--force]",
    );
    process.exit(1);
  }

  if (force) {
    await prisma.discordTicketSaleNotify.deleteMany({ where: { signature } });
  }

  const connection = new Connection(resolveLotteryRpcUrl(), "confirmed");
  const result = await notifyDiscordTicketSale(connection, {
    signature,
    wallet,
    drawId,
    count,
    payWith,
    tokenSymbol,
    tokenName,
    tokenImageUrl,
  });
  console.info(result);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
