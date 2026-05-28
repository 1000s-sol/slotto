/**
 * Run close_sales → request_vrf → settle for a devnet draw (permissionless; any wallet pays fees).
 * Usage: npm run lottery:settle -- [drawId]
 */
import "dotenv/config";

import * as anchor from "@coral-xyz/anchor";
import { Connection } from "@solana/web3.js";

import { crankDraw } from "../src/lib/lottery/crank-draw";
import { lotteryProgramId } from "../src/lib/lottery/config";
import { loadLotteryKeeperKeypair } from "../src/lib/lottery/keeper-wallet";
import { createLotteryProgram } from "../src/lib/lottery/program";
import { resolveLotteryRpcUrl } from "../src/lib/lottery/rpc-url";

async function main() {
  const drawId = parseInt(process.argv[2] ?? "0", 10);
  if (!Number.isFinite(drawId) || drawId < 0) {
    console.error("Usage: npm run lottery:settle -- [drawId]");
    process.exit(1);
  }

  const payer = loadLotteryKeeperKeypair();
  if (!payer) {
    console.error(
      "No keeper keypair. Set LOTTERY_KEEPER_WALLET or LOTTERY_TEST_WALLET, or add .keys/lottery-integration.json",
    );
    process.exit(1);
  }

  const rpc = resolveLotteryRpcUrl();
  const connection = new Connection(rpc, "confirmed");
  const programId = lotteryProgramId();
  const wallet = new anchor.Wallet(payer);
  const program = createLotteryProgram(connection, wallet);

  const result = await crankDraw(
    connection,
    program,
    programId,
    drawId,
    payer,
  );
  console.info(
    `Draw #${drawId}: ${result.initialState} → ${result.finalState}`,
  );
  for (let i = 0; i < result.actions.length; i += 1) {
    const action = result.actions[i];
    const sig = result.signatures[i];
    console.info(sig ? `${action}: ${sig}` : action);
  }
  if (result.winner) {
    console.info(
      `Winner ${result.winner} (ticket #${result.winningTicketId})`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
