import { PublicKey } from "@solana/web3.js";

import type { LotteryDrawView } from "@/lib/lottery/chain";
import { DrawState, LAMPORTS_SOL_TICKET_POT } from "@/lib/lottery/constants";
import type { LotteryStateSnapshot } from "@/lib/lottery/fetch-lottery-state";
import { lotteryDrawViewToJson } from "@/lib/lottery/draws";
import { sumSplTicketsSold } from "@/lib/lottery/predicted-next-seed";

/** Stable dummy keys for UI-only demo (never signed). */
const DUMMY = new PublicKey("11111111111111111111111111111111");

/** Fake SPL sales past the 395 threshold so next-seed growth is visible. */
export const DEMO_SPL_SOLD = 420;
export const DEMO_SOL_TICKETS = 280;
export const DEMO_TOTAL_TICKETS = DEMO_SOL_TICKETS + DEMO_SPL_SOLD;

export function buildDemoLiveDraw(nowSec: number): LotteryDrawView {
  return {
    drawId: 99,
    draw: DUMMY,
    prizeVault: DUMMY,
    salesOpenTs: nowSec - 2 * 24 * 3600,
    salesCloseTs: nowSec + 5 * 24 * 3600,
    state: DrawState.Selling,
    totalTickets: DEMO_TOTAL_TICKETS,
    vrfRequest: DUMMY,
    splMints: [
      {
        mint: "Demo11111111111111111111111111111111111112",
        cap: 10_000,
        sold: 250,
        pricePerTicket: "1000000",
        decimals: 6,
        pricingMode: 1,
      },
      {
        mint: "Demo22222222222222222222222222222222222223",
        cap: 10_000,
        sold: DEMO_SPL_SOLD - 250,
        pricePerTicket: "1000000",
        decimals: 6,
        pricingMode: 1,
      },
    ],
    winningTicketId: 0,
    winner: null,
  };
}

/** Homepage-shaped lottery snapshot with a live selling draw (no RPC). */
export function buildDemoLotteryState(
  nowSec = Math.floor(Date.now() / 1000),
): LotteryStateSnapshot {
  const draw = buildDemoLiveDraw(nowSec);
  const solTickets =
    draw.totalTickets - sumSplTicketsSold(draw.splMints);
  // Fake live pot: 3 SOL seed + 90% SOL ticket contribution.
  const jackpotLamports = 3_000_000_000 + solTickets * LAMPORTS_SOL_TICKET_POT;

  return {
    activeDraw: {
      ...lotteryDrawViewToJson(draw),
      displayLabel: "#99",
      isTestDraw: true,
      displayNumber: 99,
    },
    settledDraw: null,
    settledDrawPrizeLamports: null,
    jackpotLamports,
    nowSec,
    teamVault: DUMMY.toBase58(),
    buxVault: DUMMY.toBase58(),
    setupVault: DUMMY.toBase58(),
  };
}

export const DEMO_ENTRANTS = [
  { wallet: "DemoWallet1111111111111111111111111111111", tickets: 180 },
  { wallet: "DemoWallet2222222222222222222222222222222", tickets: 150 },
  { wallet: "DemoWallet3333333333333333333333333333333", tickets: 120 },
  { wallet: "DemoWallet4444444444444444444444444444444", tickets: 95 },
  { wallet: "DemoWallet5555555555555555555555555555555", tickets: 155 },
] as const;
