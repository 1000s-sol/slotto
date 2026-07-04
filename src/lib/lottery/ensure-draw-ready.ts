import type { AnchorWallet } from "@solana/wallet-adapter-react";
import { Connection, PublicKey } from "@solana/web3.js";

import type { LotteryDrawView } from "./chain";
import { TICKETS_PER_CHUNK } from "./constants";
import { ensureTeamTokenAta } from "./ensure-team-token-ata";
import { initTicketChunk } from "./init-ticket-chunk";
import { globalConfigPda, ticketChunkPda } from "./pdas";
import { createLotteryReadOnlyProgram } from "./program";
import { ticketChunkIndicesForRange } from "./ticket-chunks";

/** Chunks required for a buy, plus the next chunk when sales approach a 256 boundary. */
export function ticketChunkIndicesToFund(
  base: number,
  count: number,
): number[] {
  const needed = ticketChunkIndicesForRange(base, count);
  const set = new Set(needed);
  const endTicket = base + count;
  // One ticket before a batch boundary (e.g. ticket 255) — fund the next chunk now.
  if (endTicket > 0 && endTicket % TICKETS_PER_CHUNK === TICKETS_PER_CHUNK - 1) {
    set.add(Math.floor(endTicket / TICKETS_PER_CHUNK) + 1);
  }
  // First ticket of a new batch (e.g. ticket 256) uses the next chunk.
  if (endTicket > 0 && endTicket % TICKETS_PER_CHUNK === 0) {
    set.add(endTicket / TICKETS_PER_CHUNK);
  }
  return [...set].sort((a, b) => a - b);
}

async function chunkInitialized(
  connection: Connection,
  chunkPk: PublicKey,
): Promise<boolean> {
  const info = await connection.getAccountInfo(chunkPk, "confirmed");
  return info != null && info.data.length > 0;
}

/**
 * Authority-only: fund team ATAs + ticket-chunk PDAs before SPL/SOL sales.
 * Chunk 0 is created in `create_draw`; chunk 1+ must be initialized here.
 */
export async function ensureDrawReadyForSales(
  connection: Connection,
  authority: AnchorWallet,
  programId: PublicKey,
  draw: LotteryDrawView,
  opts?: {
    /** SPL mints on the draw that need team ATAs (defaults to all on-chain rows). */
    splMints?: PublicKey[];
    /** Ticket chunks to fund (defaults to chunk 1 for new draws). */
    chunkIndices?: number[];
    walletSendOpts?: Parameters<typeof ensureTeamTokenAta>[4];
  },
): Promise<{ teamAtaSigs: string[]; chunkSigs: string[] }> {
  const program = createLotteryReadOnlyProgram(connection);
  const cfg = await program.account.globalConfig.fetch(globalConfigPda(programId));

  if (!cfg.authority.equals(authority.publicKey)) {
    throw new Error(
      `Wallet ${authority.publicKey.toBase58()} is not the on-chain lottery authority.`,
    );
  }

  const teamAtaSigs: string[] = [];
  const mints =
    opts?.splMints ??
    draw.splMints.map((r) => new PublicKey(r.mint));

  for (const mint of mints) {
    const sig = await ensureTeamTokenAta(
      connection,
      authority,
      programId,
      mint,
      opts?.walletSendOpts,
      cfg.teamVault,
    );
    teamAtaSigs.push(sig);
  }

  const chunkIndices =
    opts?.chunkIndices ??
    ticketChunkIndicesToFund(draw.totalTickets, 1).filter((i) => i >= 1);

  const chunkSigs: string[] = [];
  for (const idx of chunkIndices) {
    if (idx === 0) continue;
    const chunkPk = ticketChunkPda(programId, draw.draw, idx);
    if (await chunkInitialized(connection, chunkPk)) continue;
    const sig = await initTicketChunk(
      connection,
      authority,
      programId,
      draw.draw,
      idx,
    );
    chunkSigs.push(sig);
  }

  return { teamAtaSigs, chunkSigs };
}

/** Before a purchase: ensure ticket chunks touched by this buy (+ next batch) exist. */
export async function ensureTicketChunksForPurchase(
  connection: Connection,
  authority: AnchorWallet,
  programId: PublicKey,
  draw: LotteryDrawView,
  count: number,
): Promise<string[]> {
  const base = draw.totalTickets;
  const indices = ticketChunkIndicesToFund(base, count);
  const sigs: string[] = [];
  for (const idx of indices) {
    if (idx === 0) continue;
    const chunkPk = ticketChunkPda(programId, draw.draw, idx);
    if (await chunkInitialized(connection, chunkPk)) continue;
    sigs.push(
      await initTicketChunk(connection, authority, programId, draw.draw, idx),
    );
  }
  return sigs;
}
