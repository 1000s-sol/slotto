import { LAMPORTS_SOL_TICKET_PRICE } from "@/lib/lottery/constants";
import { BUYBACK_RATE } from "@/lib/lottery/buyback-rate";

/** SPL tickets needed to recoup the guaranteed next-draw seed. Fixed by product. */
export const SPL_TICKETS_TO_RECOUP_SEED = 395;

/** Guaranteed minimum next-draw seed (SOL), before SPL sales can grow it. */
export const NEXT_SEED_FLOOR_SOL = 3;

/** SPL ticket notional vs SOL face (~5% discount). */
export const SPL_TICKET_PRICE_FACTOR = 0.95;

const LAMPORTS_PER_SOL = 1_000_000_000;

/**
 * Expected SOL recovered per SPL ticket after discount + 80% buyback.
 * Prediction only — not an on-chain settlement figure.
 */
export function expectedSolPerSplTicket(): number {
  const faceSol = LAMPORTS_SOL_TICKET_PRICE / LAMPORTS_PER_SOL;
  return faceSol * SPL_TICKET_PRICE_FACTOR * BUYBACK_RATE;
}

/**
 * Predicted next-draw seed from SPL ticket sales this draw.
 * Stays at the 3 SOL floor until 395 SPL tickets, then grows with each extra sale.
 */
export function predictedNextSeedSol(splTicketsSold: number): number {
  const sold = Math.max(0, Math.floor(splTicketsSold));
  const extra = Math.max(0, sold - SPL_TICKETS_TO_RECOUP_SEED);
  return NEXT_SEED_FLOOR_SOL + extra * expectedSolPerSplTicket();
}

export function formatPredictedSeedSol(sol: number): string {
  if (!Number.isFinite(sol)) return "—";
  if (sol >= 100) {
    return sol.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  return sol.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 3,
  });
}

/** Sum SPL tickets sold on a draw (optional free-entry mint filter). */
export function sumSplTicketsSold(
  rows: Array<{ sold: number; mint?: string }>,
  opts?: { excludeMint?: (mint: string) => boolean },
): number {
  let n = 0;
  for (const row of rows) {
    if (row.mint && opts?.excludeMint?.(row.mint)) continue;
    n += Math.max(0, Number(row.sold) || 0);
  }
  return n;
}
