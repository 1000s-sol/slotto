/**
 * Poll devnet and crank any draws past sales_close that are not settled yet.
 * Usage: npm run lottery:keeper [--intervalSec]
 */
import "dotenv/config";

import * as anchor from "@coral-xyz/anchor";
import { Connection } from "@solana/web3.js";

import {
  crankAllPendingDraws,
  fetchDrawIdsNeedingCrank,
} from "../src/lib/lottery/crank-draw";
import { lotteryProgramId } from "../src/lib/lottery/config";
import { loadLotteryKeeperKeypair } from "../src/lib/lottery/keeper-wallet";
import { createLotteryProgram } from "../src/lib/lottery/program";

async function tick(
  connection: Connection,
  program: ReturnType<typeof createLotteryProgram>,
  programId: ReturnType<typeof lotteryProgramId>,
) {
  const ids = await fetchDrawIdsNeedingCrank(connection, programId);
  if (ids.length === 0) {
    console.info(`${new Date().toISOString()} — nothing to crank`);
    return;
  }
  console.info(
    `${new Date().toISOString()} — cranking draw(s): ${ids.join(", ")}`,
  );
  const results = await crankAllPendingDraws(connection, program, programId);
  for (const r of results) {
    console.info(
      `  #${r.drawId}: ${r.initialState} → ${r.finalState} [${r.actions.join(", ")}]`,
    );
    if (r.winner) {
      console.info(`    winner ${r.winner} ticket #${r.winningTicketId}`);
    }
  }
}

async function main() {
  const intervalSec = Math.max(
    15,
    parseInt(process.argv[2] ?? "45", 10) || 45,
  );
  const payer = loadLotteryKeeperKeypair();
  if (!payer) {
    console.error(
      "No keeper keypair. Set LOTTERY_KEEPER_WALLET or LOTTERY_TEST_WALLET.",
    );
    process.exit(1);
  }

  const rpc =
    process.env.LOTTERY_DEVNET_RPC?.trim() ||
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.trim() ||
    "https://api.devnet.solana.com";
  const connection = new Connection(rpc, "confirmed");
  const programId = lotteryProgramId();
  const program = createLotteryProgram(
    connection,
    new anchor.Wallet(payer),
  );

  console.info(
    `Lottery keeper on ${rpc} (every ${intervalSec}s, wallet ${payer.publicKey.toBase58()})`,
  );

  for (;;) {
    try {
      await tick(connection, program, programId);
    } catch (e) {
      console.error(e);
    }
    await new Promise((r) => setTimeout(r, intervalSec * 1000));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
