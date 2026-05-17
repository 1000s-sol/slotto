/**
 * Run close_sales → request_vrf → settle for a devnet draw (permissionless; any wallet pays fees).
 * Usage: npm run lottery:settle -- [drawId]
 */
import "dotenv/config";

import * as anchor from "@coral-xyz/anchor";
import fs from "node:fs";
import {
  Connection,
  Keypair,
  PublicKey,
  SYSVAR_CLOCK_PUBKEY,
} from "@solana/web3.js";

import { fetchDrawById } from "../src/lib/lottery/chain";
import { DrawState } from "../src/lib/lottery/constants";
import { lotteryProgramId } from "../src/lib/lottery/config";
import { createLotteryProgram } from "../src/lib/lottery/program";
import {
  stubWinningTicketId,
  ticketChunkIndex,
  ticketSlotInChunk,
} from "../src/lib/lottery/stub-settle";
import { ticketChunkPda } from "../src/lib/lottery/pdas";

const STATE_NAMES = [
  "Selling",
  "SalesClosed",
  "VrfRequested",
  "Settled",
  "Refunded",
] as const;

function loadPayer(): Keypair {
  const path =
    process.env.LOTTERY_TEST_WALLET?.trim() || ".keys/lottery-integration.json";
  const raw = JSON.parse(fs.readFileSync(path, "utf8")) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

async function main() {
  const drawId = parseInt(process.argv[2] ?? "0", 10);
  if (!Number.isFinite(drawId) || drawId < 0) {
    console.error("Usage: npm run lottery:settle -- [drawId]");
    process.exit(1);
  }

  const rpc =
    process.env.LOTTERY_DEVNET_RPC?.trim() ||
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.trim() ||
    "https://api.devnet.solana.com";
  const connection = new Connection(rpc, "confirmed");
  const payer = loadPayer();
  const programId = lotteryProgramId();
  const wallet = new anchor.Wallet(payer);
  const program = createLotteryProgram(connection, wallet);

  let draw = await fetchDrawById(connection, programId, drawId);
  if (!draw) {
    console.error(`Draw #${drawId} not found on ${rpc}`);
    process.exit(1);
  }

  const stateName = STATE_NAMES[draw.state] ?? `unknown(${draw.state})`;
  console.info(`Draw #${drawId} state: ${stateName}, tickets: ${draw.totalTickets}`);

  if (draw.state === DrawState.Settled) {
    console.info(`Already settled. Winner: ${draw.winner}, ticket #${draw.winningTicketId}`);
    return;
  }

  if (draw.state === DrawState.Refunded) {
    console.info("Draw was refunded (no tickets).");
    return;
  }

  if (draw.state === DrawState.Selling) {
    console.info("close_sales…");
    const sig = await program.methods
      .closeSales()
      .accounts({ draw: draw.draw })
      .rpc();
    console.info("  ", sig);
    draw = (await fetchDrawById(connection, programId, drawId))!;
  }

  if (draw.state === DrawState.SalesClosed) {
    if (draw.totalTickets === 0) {
      console.info("No tickets sold — use refund_empty_draw instead of settle.");
      process.exit(1);
    }
    console.info("request_vrf…");
    const sig = await program.methods
      .requestVrf()
      .accounts({ draw: draw.draw })
      .rpc();
    console.info("  ", sig);
    draw = (await fetchDrawById(connection, programId, drawId))!;
  }

  if (draw.state === DrawState.VrfRequested) {
    const clockInfo = await connection.getAccountInfo(SYSVAR_CLOCK_PUBKEY);
    if (!clockInfo || clockInfo.data.length < 40) {
      throw new Error("Could not read clock sysvar");
    }
    const slot = clockInfo.data.readBigUInt64LE(0);
    const unixTs = clockInfo.data.readBigInt64LE(32);

    const winningId = stubWinningTicketId(
      draw.draw,
      slot,
      unixTs,
      draw.totalTickets,
    );
    const chunkIdx = ticketChunkIndex(winningId);
    const slotInChunk = ticketSlotInChunk(winningId);
    const chunkPk = ticketChunkPda(programId, draw.draw, chunkIdx);
    const chunk = await program.account.ticketChunk.fetch(chunkPk);
    const winnerPk = chunk.owners[slotInChunk];

    console.info(
      `settle (ticket #${winningId}, winner ${winnerPk.toBase58()})…`,
    );
    const sig = await program.methods
      .settle()
      .accounts({
        draw: draw.draw,
        prizeVault: draw.prizeVault,
      })
      .remainingAccounts([
        { pubkey: chunkPk, isWritable: true, isSigner: false },
        { pubkey: winnerPk, isWritable: true, isSigner: false },
      ])
      .rpc();
    console.info("  ", sig);

    draw = (await fetchDrawById(connection, programId, drawId))!;
    console.info(
      `Done. Winner ${draw.winner} (ticket #${draw.winningTicketId})`,
    );
    return;
  }

  console.error(`Unexpected state: ${draw.state}`);
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
