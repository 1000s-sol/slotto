/** Matches on-chain `LAMPORTS_SOL_TICKET_*` and `DrawState`. */
export const LAMPORTS_PER_SOL_TICKET = 10_500_000;
export const LAMPORTS_SOL_TICKET_POT = 9_000_000;
export const TICKETS_PER_CHUNK = 256;
export const MAX_SOL_TICKETS_PER_BUY = 256;

export const DrawState = {
  Selling: 0,
  SalesClosed: 1,
  VrfRequested: 2,
  Settled: 3,
  Refunded: 4,
} as const;
