import { Connection, PublicKey } from "@solana/web3.js";

import type { LotteryDrawView } from "./chain";
import { fetchDrawById } from "./chain";
import { DrawState, TICKETS_PER_CHUNK } from "./constants";
import {
  fetchDrawCount,
  fetchSettledDrawPrizeLamports,
} from "./draws";
import { ticketChunkPda } from "./pdas";
import { createLotteryReadOnlyProgram } from "./program";
import { ticketChunkIndicesForRange } from "./ticket-chunks";

export type WalletDrawTickets = {
  drawId: number;
  displayLabel: string;
  dateLabel: string;
  isLive: boolean;
  yourTickets: number;
  poolTickets: number;
  ticketIds: number[];
  outcomeLabel: string;
  outcomeVariant: "live" | "won" | "lost" | "pending";
  prizeLamports: number | null;
  paidWithMints: string[];
};

function walletSet(wallets: string[]): PublicKey[] {
  const owners: PublicKey[] = [];
  const seen = new Set<string>();
  for (const w of wallets) {
    const t = w.trim();
    if (!t || seen.has(t)) continue;
    try {
      owners.push(new PublicKey(t));
      seen.add(t);
    } catch {
      /* skip invalid */
    }
  }
  return owners;
}

async function ticketsForOwnersInDraw(
  programId: PublicKey,
  program: ReturnType<typeof createLotteryReadOnlyProgram>,
  draw: LotteryDrawView,
  owners: PublicKey[],
): Promise<{ ticketIds: number[]; winnerIsYou: boolean }> {
  const empty = PublicKey.default;
  const ownerKeys = new Set(owners.map((o) => o.toBase58()));
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
      if (!pk.equals(empty) && ownerKeys.has(pk.toBase58())) ids.push(ticketId);
    }
  }

  const winnerIsYou = Boolean(draw.winner && ownerKeys.has(draw.winner));
  return { ticketIds: ids, winnerIsYou };
}

/** Draws where any of `wallets` holds tickets (on-chain scan, server RPC). */
export async function fetchLinkedWalletDrawTickets(
  connection: Connection,
  programId: PublicKey,
  wallets: string[],
  opts?: { drawIds?: number[] },
): Promise<WalletDrawTickets[]> {
  const owners = walletSet(wallets);
  if (owners.length === 0) return [];

  const program = createLotteryReadOnlyProgram(connection);
  const drawIds =
    opts?.drawIds ??
    Array.from({ length: await fetchDrawCount(connection, programId) }, (_, i) => i);
  const draws = await Promise.all(
    drawIds.map((id) => fetchDrawById(connection, programId, id)),
  );
  const rows: WalletDrawTickets[] = [];

  for (const draw of draws) {
    if (!draw || draw.totalTickets === 0) continue;

    const { ticketIds, winnerIsYou } = await ticketsForOwnersInDraw(
      programId,
      program,
      draw,
      owners,
    );
    if (ticketIds.length === 0) continue;

    const isLive = draw.state === DrawState.Selling;
    let outcomeVariant: WalletDrawTickets["outcomeVariant"] = "lost";
    let outcomeLabel = "—";
    let prizeLamports: number | null = null;

    if (isLive) {
      outcomeVariant = "live";
      const pct = (ticketIds.length / draw.totalTickets) * 100;
      outcomeLabel = pct >= 10 ? `${pct.toFixed(1)}%` : `${pct.toFixed(2)}%`;
    } else if (draw.state === DrawState.Settled && draw.winner) {
      if (winnerIsYou) {
        outcomeVariant = "won";
        prizeLamports = await fetchSettledDrawPrizeLamports(connection, draw);
        outcomeLabel = `${(prizeLamports / 1e9).toFixed(3)} SOL`;
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
      drawId: draw.drawId,
      displayLabel: `#${draw.drawId}`,
      dateLabel: isLive
        ? "Live"
        : new Date(draw.salesCloseTs * 1000).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
            timeZone: "Europe/London",
          }),
      isLive,
      yourTickets: ticketIds.length,
      poolTickets: draw.totalTickets,
      ticketIds,
      outcomeLabel,
      outcomeVariant,
      prizeLamports,
      paidWithMints: [],
    });
  }

  return rows.sort((a, b) => b.drawId - a.drawId);
}

export async function fetchWalletDrawTickets(
  connection: Connection,
  programId: PublicKey,
  wallet: string,
): Promise<WalletDrawTickets[]> {
  return fetchLinkedWalletDrawTickets(connection, programId, [wallet]);
}
