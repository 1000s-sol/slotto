import { Connection, PublicKey } from "@solana/web3.js";

import type { LotteryDrawView } from "./chain";
import { fetchDrawById } from "./chain";
import { DrawState } from "./constants";
import {
  fetchDrawCount,
  formatDrawDateLabel,
  fetchWinnerPrizeLamports,
} from "./draws";
import { ticketChunkPda } from "./pdas";
import { createLotteryReadOnlyProgram } from "./program";
import { ticketChunkIndicesForRange } from "./ticket-chunks";
import { TICKETS_PER_CHUNK } from "./constants";

export type WalletDrawTickets = {
  drawId: number;
  dateLabel: string;
  isLive: boolean;
  yourTickets: number;
  poolTickets: number;
  ticketIds: number[];
  outcomeLabel: string;
  outcomeVariant: "live" | "won" | "lost" | "pending";
};

export async function fetchWalletDrawTickets(
  connection: Connection,
  programId: PublicKey,
  wallet: string,
): Promise<WalletDrawTickets[]> {
  const owner = new PublicKey(wallet);
  const n = await fetchDrawCount(connection, programId);
  const program = createLotteryReadOnlyProgram(connection);
  const rows: WalletDrawTickets[] = [];

  for (let drawId = 0; drawId < n; drawId += 1) {
    const draw = await fetchDrawById(connection, programId, drawId);
    if (!draw || draw.totalTickets === 0) continue;

    const ticketIds = await ticketIdsForOwner(
      connection,
      programId,
      program,
      draw,
      owner,
    );
    if (ticketIds.length === 0) continue;

    const isLive = draw.state === DrawState.Selling;
    let outcomeVariant: WalletDrawTickets["outcomeVariant"] = "lost";
    let outcomeLabel = "—";

    if (isLive) {
      outcomeVariant = "live";
      const pct = (ticketIds.length / draw.totalTickets) * 100;
      outcomeLabel = pct >= 10 ? `${pct.toFixed(1)}%` : `${pct.toFixed(2)}%`;
    } else if (draw.state === DrawState.Settled && draw.winner) {
      if (draw.winner === wallet) {
        outcomeVariant = "won";
        const lamports = await fetchWinnerPrizeLamports(connection, wallet, draw);
        outcomeLabel = `${(lamports / 1e9).toFixed(2)} SOL`;
      } else {
        outcomeVariant = "lost";
        outcomeLabel = "—";
      }
    } else if (
      draw.state === DrawState.SalesClosed ||
      draw.state === DrawState.VrfRequested
    ) {
      outcomeVariant = "pending";
      outcomeLabel = "Awaiting draw";
    } else if (draw.state === DrawState.Refunded) {
      outcomeLabel = "Refunded";
    }

    rows.push({
      drawId,
      dateLabel: isLive ? "Live" : formatDrawDateLabel(draw.salesCloseTs),
      isLive,
      yourTickets: ticketIds.length,
      poolTickets: draw.totalTickets,
      ticketIds,
      outcomeLabel,
      outcomeVariant,
    });
  }

  return rows.sort((a, b) => b.drawId - a.drawId);
}

async function ticketIdsForOwner(
  connection: Connection,
  programId: PublicKey,
  program: ReturnType<typeof createLotteryReadOnlyProgram>,
  draw: LotteryDrawView,
  owner: PublicKey,
): Promise<number[]> {
  const empty = PublicKey.default;
  const ids: number[] = [];
  const chunkIndices = ticketChunkIndicesForRange(0, draw.totalTickets);

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
      const pk = chunk.owners[slot];
      if (!pk.equals(empty) && pk.equals(owner)) ids.push(ticketId);
    }
  }

  return ids;
}
