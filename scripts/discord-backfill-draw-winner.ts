/**
 * Post a winner embed to all Discord guilds with /slotto-setup configured.
 * Usage: npm run discord:backfill-winner -- [drawId]
 */
import "dotenv/config";

import { Connection } from "@solana/web3.js";

import { notifyDiscordDrawWinner } from "../src/lib/discord-ticket-bot/post-draw-winner";
import { resolveLotteryRpcUrl } from "../src/lib/lottery/rpc-url";

async function main() {
  const drawId = parseInt(process.argv[2] ?? "9", 10);

  if (!Number.isFinite(drawId) || drawId < 0) {
    console.error("Usage: npm run discord:backfill-winner -- [drawId]");
    process.exit(1);
  }

  const connection = new Connection(resolveLotteryRpcUrl(), "confirmed");
  const result = await notifyDiscordDrawWinner(connection, drawId);

  if (result.skipped) {
    console.info(
      `Draw #${drawId}: skipped${result.reason ? ` (${result.reason})` : ""}`,
    );
    if (result.reason === "no guild channels configured") {
      console.info("Run /slotto-setup in Discord first, then retry.");
      process.exit(1);
    }
    process.exit(result.posted > 0 ? 0 : 0);
  }

  console.info(`Draw #${drawId}: posted winner embed to ${result.posted} channel(s)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
