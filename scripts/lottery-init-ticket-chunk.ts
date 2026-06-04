/**
 * Authority-only: fund ticket-chunk PDA rent before sales cross 256-ticket boundaries.
 * Chunk 0 is created in create_draw; chunk 1+ must be initialized manually.
 *
 * Usage:
 *   npm run lottery:init-chunk -- [drawId] [chunkIndex]
 *
 * - drawId: optional — defaults to the current Selling draw
 * - chunkIndex: optional — defaults to the chunk needed for the next ticket sale
 *
 * Requires the on-chain lottery authority keypair (same wallet as create_draw):
 *   LOTTERY_KEEPER_SECRET_KEY, LOTTERY_DEPLOY_WALLET, or LOTTERY_TEST_WALLET
 */
import "dotenv/config";

import { Connection } from "@solana/web3.js";

import { fetchDrawById, fetchLotteryDraw } from "../src/lib/lottery/chain";
import { lotteryProgramId } from "../src/lib/lottery/config";
import { DrawState, TICKETS_PER_CHUNK } from "../src/lib/lottery/constants";
import { initTicketChunk } from "../src/lib/lottery/init-ticket-chunk";
import {
  keypairToAnchorWallet,
  loadLotteryKeeperKeypair,
} from "../src/lib/lottery/keeper-wallet";
import { ticketChunkPda } from "../src/lib/lottery/pdas";
import { createLotteryReadOnlyProgram } from "../src/lib/lottery/program";
import { resolveLotteryRpcUrl } from "../src/lib/lottery/rpc-url";
import { ticketChunkIndicesForRange } from "../src/lib/lottery/ticket-chunks";

function parseOptionalInt(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

async function main() {
  const drawIdArg = parseOptionalInt(process.argv[2]);
  const chunkIndexArg = parseOptionalInt(process.argv[3]);

  const payer = loadLotteryKeeperKeypair();
  if (!payer) {
    console.error(
      "No authority keypair. Set LOTTERY_KEEPER_SECRET_KEY, LOTTERY_DEPLOY_WALLET, or LOTTERY_TEST_WALLET.",
    );
    process.exit(1);
  }

  const rpc = resolveLotteryRpcUrl();
  const connection = new Connection(rpc, "confirmed");
  const programId = lotteryProgramId();
  const wallet = keypairToAnchorWallet(payer);
  const program = createLotteryReadOnlyProgram(connection);

  const cfg = await program.account.globalConfig.fetch(
    (await import("../src/lib/lottery/pdas")).globalConfigPda(programId),
  );
  if (!cfg.authority.equals(payer.publicKey)) {
    console.error(
      `Wallet ${payer.publicKey.toBase58()} is not the on-chain authority (${cfg.authority.toBase58()}).`,
    );
    console.error("Use the admin wallet that created draws / initialized the program.");
    process.exit(1);
  }

  let drawId = drawIdArg;
  if (drawId === undefined) {
    const live = await fetchLotteryDraw(connection, programId);
    if (!live) {
      console.error("No draw found. Pass drawId explicitly.");
      process.exit(1);
    }
    drawId = live.drawId;
  }

  const draw = await fetchDrawById(connection, programId, drawId);
  if (!draw) {
    console.error(`Draw #${drawId} not found.`);
    process.exit(1);
  }
  if (draw.state !== DrawState.Selling) {
    console.error(
      `Draw #${drawId} is not Selling (state=${draw.state}). Cannot init ticket chunks.`,
    );
    process.exit(1);
  }

  let chunkIndex = chunkIndexArg;
  if (chunkIndex === undefined) {
    const needed = ticketChunkIndicesForRange(draw.totalTickets, 1);
    if (needed.length === 0) {
      console.error("Could not infer chunk index from draw.totalTickets.");
      process.exit(1);
    }
    chunkIndex = needed[0];
  }

  if (chunkIndex === 0) {
    console.error(
      "Chunk 0 is created with create_draw. Pass chunkIndex >= 1 explicitly if you meant another chunk.",
    );
    process.exit(1);
  }

  const chunkPk = ticketChunkPda(programId, draw.draw, chunkIndex);
  const existing = await connection.getAccountInfo(chunkPk, "confirmed");
  if (existing) {
    console.info(
      `Chunk ${chunkIndex} already initialized for draw #${drawId}: ${chunkPk.toBase58()}`,
    );
    console.info(
      `Draw has ${draw.totalTickets} tickets sold (chunk size ${TICKETS_PER_CHUNK}). Sales should work if this is the right chunk.`,
    );
    process.exit(0);
  }

  const ticketRangeStart = chunkIndex * TICKETS_PER_CHUNK;
  const ticketRangeEnd = ticketRangeStart + TICKETS_PER_CHUNK - 1;

  console.info("RPC:", rpc);
  console.info("Authority:", payer.publicKey.toBase58());
  console.info(`Draw #${drawId}: ${draw.draw.toBase58()}`);
  console.info(`Total tickets sold: ${draw.totalTickets}`);
  console.info(
    `Initializing chunk ${chunkIndex} (tickets ${ticketRangeStart}–${ticketRangeEnd}) → ${chunkPk.toBase58()}`,
  );
  console.info("Paying ~0.058 SOL rent from authority wallet…");

  const sig = await initTicketChunk(
    connection,
    wallet,
    programId,
    draw.draw,
    chunkIndex,
  );

  console.info("Done. tx:", sig);
  console.info(
    `(Solscan: https://solscan.io/tx/${sig}${process.env.LOTTERY_CLUSTER === "devnet" || rpc.includes("devnet") ? "?cluster=devnet" : ""})`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
