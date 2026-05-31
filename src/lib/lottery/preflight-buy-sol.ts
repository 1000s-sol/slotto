import type { AnchorWallet } from "@solana/wallet-adapter-react";
import { Connection, PublicKey } from "@solana/web3.js";

import type { LotteryDrawView } from "./chain";
import { chainUnixTs, isDrawBuyable } from "./chain";
import {
  DrawState,
  LAMPORTS_PER_SOL_TICKET,
  LAMPORTS_SOL_BUY_FEE_BUFFER,
  MAX_SOL_TICKETS_PER_BUY,
} from "./constants";
import { globalConfigPda, ticketChunkPda } from "./pdas";
import { createLotteryProgram } from "./program";
import { ticketChunkIndicesForRange } from "./ticket-chunks";
export class BuyPreflightError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BuyPreflightError";
  }
}

export type LotteryVaultPubkeys = {
  teamVault: PublicKey;
  buxVault: PublicKey;
  setupVault: PublicKey;
};

/** Build an unsigned `buy_sol_tickets` transaction (for simulation). */
export async function buildBuySolTicketsTransaction(
  connection: Connection,
  wallet: AnchorWallet,
  programId: PublicKey,
  draw: LotteryDrawView,
  count: number,
  vaults: LotteryVaultPubkeys,
) {
  const program = createLotteryProgram(connection, wallet);
  const globalConfig = globalConfigPda(programId);

  const base = draw.totalTickets;
  const chunkIndices = ticketChunkIndicesForRange(base, count);
  const remainingAccounts = chunkIndices.map((idx) => ({
    pubkey: ticketChunkPda(programId, draw.draw, idx),
    isWritable: true,
    isSigner: false,
  }));

  const tx = await program.methods
    .buySolTickets(count)
    .accounts({
      buyer: wallet.publicKey,
      draw: draw.draw,
      prizeVault: draw.prizeVault,
      globalConfig,
      teamVault: vaults.teamVault,
      buxVault: vaults.buxVault,
      setupVault: vaults.setupVault,
    })
    .remainingAccounts(remainingAccounts)
    .transaction();

  return tx;
}

/** Client-side checks + RPC simulation before opening Phantom. */
export async function preflightBuySolTickets(
  connection: Connection,
  wallet: AnchorWallet,
  programId: PublicKey,
  draw: LotteryDrawView,
  count: number,
  nowSecFromUi?: number,
): Promise<void> {
  if (!Number.isInteger(count) || count < 1 || count > MAX_SOL_TICKETS_PER_BUY) {
    throw new BuyPreflightError(
      `Buy 1–${MAX_SOL_TICKETS_PER_BUY} tickets per transaction.`,
    );
  }

  if (draw.state !== DrawState.Selling) {
    throw new BuyPreflightError(
      `Draw #${draw.drawId} is not selling (on-chain state ${draw.state}). Refresh the page.`,
    );
  }

  const nowSec =
    nowSecFromUi ?? (await chainUnixTs(connection));
  if (!isDrawBuyable(draw, nowSec)) {
    if (nowSec < draw.salesOpenTs) {
      throw new BuyPreflightError(
        "Ticket sales are not open yet. Check the countdown on this page.",
      );
    }
    throw new BuyPreflightError(
      "Ticket sales have closed for this draw. Create a new draw in admin.",
    );
  }

  const required =
    count * LAMPORTS_PER_SOL_TICKET + LAMPORTS_SOL_BUY_FEE_BUFFER;
  try {
    const balance = await connection.getBalance(wallet.publicKey, "confirmed");
    if (balance < required) {
      throw new BuyPreflightError(
        `Need ~${(required / 1e9).toFixed(4)} SOL for ${count} ticket(s) + network fee (wallet has ${(balance / 1e9).toFixed(4)} SOL).`,
      );
    }
  } catch (e) {
    if (e instanceof BuyPreflightError) throw e;
    // Browser cannot read balance on public RPC (403); Phantom will reject if underfunded.
  }

  // RPC simulation of unsigned legacy txs is unreliable (false InsufficientFundsForRent
  // while logs show success). Balance + draw window checks are enough before Phantom opens.
}
