/**
 * Post the official @slottogg_ winner tweet for a settled draw (idempotent via DB claim).
 * Usage: npm run x:backfill-winner -- [drawId]
 */
import "dotenv/config";

import { Connection } from "@solana/web3.js";

import { announceDrawEnded } from "../src/lib/lottery/announce-draw";
import { fetchDrawById } from "../src/lib/lottery/chain";
import { lotteryProgramId } from "../src/lib/lottery/config";
import { DrawState } from "../src/lib/lottery/constants";
import { fetchSettledDrawPrizeLamports } from "../src/lib/lottery/draws";
import { resolveLotteryRpcUrl } from "../src/lib/lottery/rpc-url";
import { xPostingConfigured } from "../src/lib/x/post-tweet";

async function main() {
  const drawId = parseInt(process.argv[2] ?? "9", 10);
  if (!Number.isFinite(drawId) || drawId < 0) {
    console.error("Usage: npm run x:backfill-winner -- [drawId]");
    process.exit(1);
  }

  if (!xPostingConfigured()) {
    console.error(
      "X posting not configured. Set SLOTTO_X_POSTING_ENABLED=true and SLOTTO_X_* keys in .env.",
    );
    process.exit(1);
  }

  const connection = new Connection(resolveLotteryRpcUrl(), "confirmed");
  const draw = await fetchDrawById(connection, lotteryProgramId(), drawId);
  if (!draw) {
    console.error(`Draw #${drawId} not found on-chain.`);
    process.exit(1);
  }
  if (draw.state !== DrawState.Settled || !draw.winner) {
    console.error(`Draw #${drawId} is not settled (state=${draw.state}).`);
    process.exit(1);
  }

  const prizeLamports = await fetchSettledDrawPrizeLamports(connection, draw);

  await announceDrawEnded({
    drawId,
    winner: draw.winner,
    prizeLamports,
    totalTickets: draw.totalTickets,
    refunded: false,
  });

  console.info(`Draw #${drawId}: X winner announcement posted (or already claimed).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
