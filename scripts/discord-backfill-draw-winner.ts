/**
 * Post the winner embed for a settled draw (idempotent unless --force).
 * Usage: npm run discord:backfill-winner -- [drawId] [--force]
 */
import "dotenv/config";

import { Connection } from "@solana/web3.js";

import { notifyDiscordDrawWinner } from "../src/lib/discord-ticket-bot/post-draw-winner";
import { getDrawDisplayMeta } from "../src/lib/lottery/draw-display-db";
import { releaseDiscordDrawEmbedClaim } from "../src/lib/lottery/discord-draw-embed-idempotency";
import { resolveLotteryRpcUrl } from "../src/lib/lottery/rpc-url";
import { discordLotteryTestChannelId } from "../src/lib/lottery/test-mode";

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const drawId = parseInt(args.find((a) => !a.startsWith("--")) ?? "9", 10);

  if (!Number.isFinite(drawId) || drawId < 0) {
    console.error("Usage: npm run discord:backfill-winner -- [drawId] [--force]");
    process.exit(1);
  }

  const meta = await getDrawDisplayMeta(drawId);
  if (!meta || meta.kind === "TEST") {
    const testChannel = discordLotteryTestChannelId();
    console.info(
      `Draw ${drawId} is TEST${meta ? "" : " (no display meta)"}; Discord will only go to DISCORD_LOTTERY_TEST_CHANNEL_ID.`,
    );
    if (!testChannel) {
      console.error(
        "Refuse: TEST draw and DISCORD_LOTTERY_TEST_CHANNEL_ID is unset. Will not post to public guilds.",
      );
      process.exit(1);
    }
    console.info(`Test channel: ${testChannel}`);
  }

  if (force) {
    await releaseDiscordDrawEmbedClaim(drawId, "ended");
    console.info(`cleared Discord ended claim for draw ${drawId}`);
  }

  const connection = new Connection(resolveLotteryRpcUrl(), "confirmed");
  const result = await notifyDiscordDrawWinner(connection, drawId);

  if (result.skipped) {
    console.info(
      `Draw #${drawId}: skipped${result.reason ? ` (${result.reason})` : ""}`,
    );
    if (result.reason === "already posted") {
      console.info("Re-run with --force to post again.");
    }
    process.exit(0);
  }

  console.info(`Draw #${drawId}: posted winner embed to ${result.posted} channel(s)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
