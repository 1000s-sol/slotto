/**
 * One-shot authority force_settle (no Prisma / announcements).
 * Usage: npx tsx scripts/force-settle-once.ts <drawId>
 */
import "dotenv/config";

import * as anchor from "@coral-xyz/anchor";
import { Connection } from "@solana/web3.js";

import { fetchDrawById } from "../src/lib/lottery/chain";
import { lotteryProgramId } from "../src/lib/lottery/config";
import { forceSettleDraw } from "../src/lib/lottery/force-settle";
import { loadLotteryKeeperKeypair } from "../src/lib/lottery/keeper-wallet";
import { createLotteryProgram } from "../src/lib/lottery/program";
import { resolveLotteryRpcUrl } from "../src/lib/lottery/rpc-url";

async function main() {
  const drawId = parseInt(process.argv[2] ?? "", 10);
  if (!Number.isFinite(drawId) || drawId < 0) {
    console.error("Usage: npx tsx scripts/force-settle-once.ts <drawId>");
    process.exit(1);
  }

  const payer = loadLotteryKeeperKeypair();
  if (!payer) {
    console.error("No keeper keypair");
    process.exit(1);
  }

  const rpc = resolveLotteryRpcUrl();
  const connection = new Connection(rpc, "confirmed");
  const programId = lotteryProgramId();
  const program = createLotteryProgram(connection, new anchor.Wallet(payer));

  const before = await fetchDrawById(connection, programId, drawId);
  if (!before) throw new Error(`Draw #${drawId} not found`);
  console.info(
    `Draw #${drawId} before: state=${before.state} tickets=${before.totalTickets}`,
  );

  const { signature, winningTicketId } = await forceSettleDraw(
    connection,
    program,
    programId,
    payer,
    drawId,
  );
  console.info(`force_settle: ${signature}`);
  console.info(`winning ticket #${winningTicketId}`);

  const after = await fetchDrawById(connection, programId, drawId);
  console.info(
    `Draw #${drawId} after: state=${after?.state} winner=${after?.winner?.toBase58?.() ?? "?"}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
