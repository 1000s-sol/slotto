import { Connection, PublicKey } from "@solana/web3.js";

import type { LotteryDrawView } from "./chain";
import { TICKETS_PER_CHUNK } from "./constants";
import { ticketChunkPda } from "./pdas";
import { createLotteryReadOnlyProgram } from "./program";
import { ticketChunkIndicesForRange } from "./ticket-chunks";

export type DrawEntrant = {
  wallet: string;
  tickets: number;
};

/** Aggregate ticket owners from on-chain ticket-chunk PDAs. */
export async function fetchDrawEntrants(
  connection: Connection,
  programId: PublicKey,
  draw: LotteryDrawView,
): Promise<DrawEntrant[]> {
  if (draw.totalTickets === 0) return [];

  const program = createLotteryReadOnlyProgram(connection);
  const chunkIndices = ticketChunkIndicesForRange(0, draw.totalTickets);
  const empty = PublicKey.default.toBase58();
  const counts = new Map<string, number>();

  for (const chunkIdx of chunkIndices) {
    const chunkPk = ticketChunkPda(programId, draw.draw, chunkIdx);
    let chunk;
    try {
      chunk = await program.account.ticketChunk.fetch(chunkPk);
    } catch {
      continue;
    }

    const chunkStart = chunkIdx * TICKETS_PER_CHUNK;
    const end = Math.min(draw.totalTickets, chunkStart + TICKETS_PER_CHUNK);
    for (let ticketId = chunkStart; ticketId < end; ticketId += 1) {
      const slot = ticketId - chunkStart;
      const wallet = chunk.owners[slot].toBase58();
      if (wallet === empty) continue;
      counts.set(wallet, (counts.get(wallet) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([wallet, tickets]) => ({ wallet, tickets }))
    .sort((a, b) => b.tickets - a.tickets);
}
