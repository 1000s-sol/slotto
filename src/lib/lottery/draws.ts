import { Connection, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";

import type { LotteryDrawView } from "./chain";
import { fetchDrawById, fetchJackpotLamports } from "./chain";
import { DrawState, LAMPORTS_SOL_TICKET_POT } from "./constants";
import { globalConfigPda } from "./pdas";
import { createLotteryReadOnlyProgram } from "./program";

/** JSON-safe draw for server actions → client. */
export type LotteryDrawViewJson = {
  drawId: number;
  draw: string;
  prizeVault: string;
  salesOpenTs: number;
  salesCloseTs: number;
  state: number;
  totalTickets: number;
  vrfRequest: string;
  splMints: LotteryDrawView["splMints"];
  winningTicketId: number;
  winner: string | null;
};

export function lotteryDrawViewToJson(d: LotteryDrawView): LotteryDrawViewJson {
  return {
    drawId: d.drawId,
    draw: d.draw.toBase58(),
    prizeVault: d.prizeVault.toBase58(),
    salesOpenTs: d.salesOpenTs,
    salesCloseTs: d.salesCloseTs,
    state: d.state,
    totalTickets: d.totalTickets,
    vrfRequest: d.vrfRequest.toBase58(),
    splMints: d.splMints,
    winningTicketId: d.winningTicketId,
    winner: d.winner,
  };
}

export function lotteryDrawViewFromJson(j: LotteryDrawViewJson): LotteryDrawView {
  return {
    drawId: j.drawId,
    draw: new PublicKey(j.draw),
    prizeVault: new PublicKey(j.prizeVault),
    salesOpenTs: j.salesOpenTs,
    salesCloseTs: j.salesCloseTs,
    state: j.state,
    totalTickets: j.totalTickets,
    vrfRequest: new PublicKey(j.vrfRequest),
    splMints: j.splMints,
    winningTicketId: j.winningTicketId,
    winner: j.winner,
  };
}

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
    if (draw) out.push(draw);
  }
  return out;
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

function balanceDeltaForKey(
  keys: { staticAccountKeys: PublicKey[] },
  meta: { preBalances: number[]; postBalances: number[] },
  target: PublicKey,
): number | null {
  const idx = keys.staticAccountKeys.findIndex((k) => k.equals(target));
  if (idx < 0) return null;
  return meta.postBalances[idx] - meta.preBalances[idx];
}

/**
 * Prize paid for a settled draw: parse the settle tx on this draw's prize vault
 * (not the winner's wallet — repeat winners would otherwise show the latest payout).
 */
export async function fetchSettledDrawPrizeLamports(
  connection: Connection,
  draw: LotteryDrawView,
): Promise<number> {
  if (!draw.winner) {
    return estimatePotFromTicketsLamports(draw.totalTickets);
  }

  const winnerPk = new PublicKey(draw.winner);
  const sigs = await connection.getSignaturesForAddress(draw.prizeVault, {
    limit: 40,
  });

  let bestPaid = 0;

  for (const { signature } of sigs) {
    const tx = await connection.getTransaction(signature, {
      maxSupportedTransactionVersion: 0,
    });
    if (!tx?.meta) continue;

    const keys = tx.transaction.message.getAccountKeys({
      accountKeysFromLookups: tx.meta.loadedAddresses,
    });
    const vaultDelta = balanceDeltaForKey(keys, tx.meta, draw.prizeVault);
    if (vaultDelta === null || vaultDelta >= 0) continue;

    const paid = -vaultDelta;
    if (paid < 500_000) continue;

    const winnerDelta = balanceDeltaForKey(keys, tx.meta, winnerPk);
    if (winnerDelta !== null && winnerDelta > 0) {
      if (Math.abs(winnerDelta - paid) <= 50_000) {
        return winnerDelta;
      }
      bestPaid = Math.max(bestPaid, winnerDelta);
    } else {
      bestPaid = Math.max(bestPaid, paid);
    }
  }

  if (bestPaid > 0) return bestPaid;
  return estimatePotFromTicketsLamports(draw.totalTickets);
}

/** Best-effort prize paid to winner for a settled draw. */
export async function fetchWinnerPrizeLamports(
  connection: Connection,
  winner: string,
  draw: LotteryDrawView,
): Promise<number> {
  if (draw.state === DrawState.Settled && draw.winner === winner) {
    return fetchSettledDrawPrizeLamports(connection, draw);
  }

  const pk = new PublicKey(winner);
  const min = Math.max(estimatePotFromTicketsLamports(draw.totalTickets), 500_000);
  const sigs = await connection.getSignaturesForAddress(pk, { limit: 30 });
  for (const { signature } of sigs) {
    const tx = await connection.getTransaction(signature, {
      maxSupportedTransactionVersion: 0,
    });
    if (!tx?.meta) continue;
    const keys = tx.transaction.message.getAccountKeys({
      accountKeysFromLookups: tx.meta.loadedAddresses,
    });
    const delta = balanceDeltaForKey(keys, tx.meta, pk);
    if (delta !== null && delta >= min) return delta;
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
