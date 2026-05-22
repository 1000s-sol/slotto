/** Matches on-chain `LAMPORTS_SOL_TICKET_*` and `DrawState`. */
export const LAMPORTS_SOL_TICKET_PRICE = 10_000_000;
export const LAMPORTS_SOL_TICKET_TEAM = 800_000;
export const LAMPORTS_SOL_TICKET_BUX = 200_000;
export const LAMPORTS_SOL_TICKET_SETUP_FEE = 500_000;
export const LAMPORTS_PER_SOL_TICKET =
  LAMPORTS_SOL_TICKET_PRICE +
  LAMPORTS_SOL_TICKET_TEAM +
  LAMPORTS_SOL_TICKET_BUX +
  LAMPORTS_SOL_TICKET_SETUP_FEE;
export const LAMPORTS_SOL_TICKET_POT = 9_000_000;
/** @deprecated Use LAMPORTS_SOL_TICKET_SETUP_FEE */
export const LAMPORTS_SOL_TICKET_FEE = LAMPORTS_SOL_TICKET_SETUP_FEE;
export const TICKETS_PER_CHUNK = 256;
export const MAX_SOL_TICKETS_PER_BUY = 256;

export const DrawState = {
  Selling: 0,
  SalesClosed: 1,
  VrfRequested: 2,
  Settled: 3,
  Refunded: 4,
} as const;
