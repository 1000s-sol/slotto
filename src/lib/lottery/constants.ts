/** Matches on-chain `LAMPORTS_SOL_TICKET_*` and `DrawState`. */
import { PublicKey } from "@solana/web3.js";

/** Nominal ticket price (0.01 SOL); pot/team/BUX/partner split is accounting, not an extra charge. */
export const LAMPORTS_SOL_TICKET_PRICE = 10_000_000;
export const LAMPORTS_SOL_TICKET_TEAM = 500_000;
/** 2% of 0.01 SOL — transferred to BUX vault in `buy_sol_tickets`. */
export const LAMPORTS_SOL_TICKET_BUX = 200_000;
/** 1.5% of 0.01 SOL — transferred to each partner vault in `buy_sol_tickets`. */
export const LAMPORTS_SOL_TICKET_PARTNER = 150_000;
/** Platform fee (0.0005 SOL) → setup vault. */
export const LAMPORTS_SOL_TICKET_SETUP_FEE = 500_000;
export const LAMPORTS_SOL_TICKET_POT = 9_000_000;
/** Lamports debited per ticket: pot + team + bux + 2× partner + setup (= 0.0105 SOL). */
export const LAMPORTS_SOL_TICKET_TOTAL =
  LAMPORTS_SOL_TICKET_POT +
  LAMPORTS_SOL_TICKET_TEAM +
  LAMPORTS_SOL_TICKET_BUX +
  LAMPORTS_SOL_TICKET_PARTNER +
  LAMPORTS_SOL_TICKET_PARTNER +
  LAMPORTS_SOL_TICKET_SETUP_FEE;
export const LAMPORTS_PER_SOL_TICKET = LAMPORTS_SOL_TICKET_TOTAL;
/** Extra lamports reserved for the Solana tx fee in preflight checks. */
export const LAMPORTS_SOL_BUY_FEE_BUFFER = 10_000;
/** @deprecated Use LAMPORTS_SOL_TICKET_SETUP_FEE */
export const LAMPORTS_SOL_TICKET_FEE = LAMPORTS_SOL_TICKET_SETUP_FEE;
export const TICKETS_PER_CHUNK = 256;
export const MAX_SOL_TICKETS_PER_BUY = 256;

/** Matches on-chain `VRF_STUB_MARKER` (devnet stub `request_vrf`). */
export const VRF_STUB_MARKER = new PublicKey(
  Buffer.from([
    ...Buffer.from("SLOTTO_VRF_STUB_v1"),
    ...Array(14).fill(0),
  ]),
);

export const DrawState = {
  Selling: 0,
  SalesClosed: 1,
  VrfRequested: 2,
  Settled: 3,
  Refunded: 4,
} as const;
