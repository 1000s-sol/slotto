import {
  Connection,
  Keypair,
  PublicKey,
  SYSVAR_CLOCK_PUBKEY,
} from "@solana/web3.js";

import { fetchDrawById } from "./chain";
import { DrawState } from "./constants";
import { globalConfigPda, ticketChunkPda } from "./pdas";
import type { SlottoLotteryProgram } from "./program";
import {
  stubWinningTicketId,
  ticketChunkIndex,
  ticketSlotInChunk,
} from "./stub-settle";

/**
 * Authority-only emergency settle when Switchboard has no eligible oracles.
 * Requires the upgraded on-chain `force_settle` instruction.
 *
 * With `totalTickets === 1` the winner is always ticket #0 (hash % 1), so this
 * is fair for draw #20's single entry regardless of the stub clock hash.
 */
export async function forceSettleDraw(
  connection: Connection,
  program: SlottoLotteryProgram,
  programId: PublicKey,
  authority: Keypair,
  drawId: number,
): Promise<{ signature: string; winningTicketId: number }> {
  const draw = await fetchDrawById(connection, programId, drawId);
  if (!draw) throw new Error(`Draw #${drawId} not found`);
  if (
    draw.state !== DrawState.SalesClosed &&
    draw.state !== DrawState.VrfRequested
  ) {
    throw new Error(
      `Draw #${drawId} cannot force-settle from state ${draw.state}`,
    );
  }
  if (draw.totalTickets < 1) {
    throw new Error(`Draw #${drawId} has no tickets to settle`);
  }

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
  if (!winnerPk || winnerPk.equals(PublicKey.default)) {
    throw new Error(`Winning ticket #${winningId} has empty owner`);
  }

  const sig = await program.methods
    .forceSettle()
    .accounts({
      authority: authority.publicKey,
      globalConfig: globalConfigPda(programId),
      draw: draw.draw,
      prizeVault: draw.prizeVault,
    })
    .remainingAccounts([
      { pubkey: chunkPk, isWritable: false, isSigner: false },
      { pubkey: winnerPk, isWritable: true, isSigner: false },
    ])
    .signers([authority])
    .rpc();

  return { signature: sig, winningTicketId: winningId };
}
