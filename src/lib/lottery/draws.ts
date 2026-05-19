import { Connection, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";

import type { LotteryDrawView } from "./chain";
import { fetchDrawById, fetchJackpotLamports } from "./chain";
import { DrawState, LAMPORTS_SOL_TICKET_POT } from "./constants";
import { readDrawSettlementFields } from "./draw-account";
import { globalConfigPda } from "./pdas";
import { createLotteryReadOnlyProgram } from "./program";

export async function fetchDrawCount(
  connection: Connection,
  programId: PublicKey,
): Promise<number> {
  const program = createLotteryReadOnlyProgram(connection);
  const cfg = await program.account.globalConfig.fetch(globalConfigPda(programId));
  return Number(cfg.nextDrawId);
}

export async function fetchAllDraws(
  connection: Connection,
  programId: PublicKey,
): Promise<LotteryDrawView[]> {
  const n = await fetchDrawCount(connection, programId);
  const out: LotteryDrawView[] = [];
  for (let id = 0; id < n; id += 1) {
    const draw = await fetchDrawById(connection, programId, id);
    if (draw) out.push(await enrichDrawFromRawAccount(connection, draw));
  }
  return out;
}

async function enrichDrawFromRawAccount(
  connection: Connection,
  draw: LotteryDrawView,
): Promise<LotteryDrawView> {
  if (draw.state !== DrawState.Settled) return draw;
  const info = await connection.getAccountInfo(draw.draw, "confirmed");
  if (!info?.data) return draw;
  const expectedWinner = draw.winner ? new PublicKey(draw.winner) : null;
  const raw = readDrawSettlementFields(
    Buffer.from(info.data),
    expectedWinner,
  );
  return {
    ...draw,
    winningTicketId:
      raw.winningTicketId > 0 ? raw.winningTicketId : draw.winningTicketId,
    winner: raw.winner?.toBase58() ?? draw.winner,
  };
}

export async function fetchActiveSellingDraw(
  connection: Connection,
  programId: PublicKey,
): Promise<LotteryDrawView | null> {
  const draws = await fetchAllDraws(connection, programId);
  return draws.find((d) => d.state === DrawState.Selling) ?? null;
}

/** Highest on-chain draw id in a terminal state (settled or refunded). */
export function highestTerminalDrawId(draws: LotteryDrawView[]): number {
  let max = -1;
  for (const d of draws) {
    if (d.state === DrawState.Settled || d.state === DrawState.Refunded) {
      max = Math.max(max, d.drawId);
    }
  }
  return max;
}

/**
 * Latest draw still in the sales / settlement pipeline.
 * Skips stale in-progress draws with id ≤ latest terminal draw (e.g. accidental
 * week-long draw #2 after #3 already settled).
 */
export async function fetchInProgressDraw(
  connection: Connection,
  programId: PublicKey,
): Promise<LotteryDrawView | null> {
  const draws = await fetchAllDraws(connection, programId);
  const floor = highestTerminalDrawId(draws);
  for (let i = draws.length - 1; i >= 0; i -= 1) {
    const d = draws[i];
    const s = d.state;
    if (
      s === DrawState.Selling ||
      s === DrawState.SalesClosed ||
      s === DrawState.VrfRequested
    ) {
      if (d.drawId <= floor) continue;
      return d;
    }
  }
  return null;
}

export async function fetchLatestSettledDraw(
  connection: Connection,
  programId: PublicKey,
): Promise<LotteryDrawView | null> {
  const draws = await fetchAllDraws(connection, programId);
  for (let i = draws.length - 1; i >= 0; i -= 1) {
    if (draws[i].state === DrawState.Settled && draws[i].winner) return draws[i];
  }
  return null;
}

export async function fetchPastSettledDraws(
  connection: Connection,
  programId: PublicKey,
): Promise<LotteryDrawView[]> {
  const draws = await fetchAllDraws(connection, programId);
  return draws.filter((d) => d.state === DrawState.Settled && d.winner);
}

export function estimatePotFromTicketsLamports(totalTickets: number): number {
  return totalTickets * LAMPORTS_SOL_TICKET_POT;
}

/** Best-effort prize paid to winner (inbound SOL on recent txs, else ticket-pot estimate). */
export async function fetchWinnerPrizeLamports(
  connection: Connection,
  winner: string,
  draw: LotteryDrawView,
): Promise<number> {
  const pk = new PublicKey(winner);
  const min = Math.max(estimatePotFromTicketsLamports(draw.totalTickets), 500_000);
  const sigs = await connection.getSignaturesForAddress(pk, { limit: 30 });
  for (const { signature } of sigs) {
    const tx = await connection.getTransaction(signature, {
      maxSupportedTransactionVersion: 0,
    });
    if (!tx?.meta) continue;
    const keys = tx.transaction.message.getAccountKeys();
    const idx = keys.staticAccountKeys.findIndex((k) => k.equals(pk));
    if (idx < 0) continue;
    const delta = tx.meta.postBalances[idx] - tx.meta.preBalances[idx];
    if (delta >= min) return delta;
  }
  return estimatePotFromTicketsLamports(draw.totalTickets);
}

export function formatDrawDateLabel(closeTs: number): string {
  return new Date(closeTs * 1000).toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  });
}

export function formatSolFromLamports(lamports: number): string {
  return (lamports / LAMPORTS_PER_SOL).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}

export async function fetchJackpotForDraw(
  connection: Connection,
  draw: LotteryDrawView,
): Promise<number> {
  if (draw.state === DrawState.Settled && draw.winner) {
    return fetchWinnerPrizeLamports(connection, draw.winner, draw);
  }
  return fetchJackpotLamports(connection, draw.prizeVault);
}
