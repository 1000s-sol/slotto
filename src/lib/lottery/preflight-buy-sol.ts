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
import { LOTTERY_PARTNER_VAULT_1, LOTTERY_PARTNER_VAULT_2 } from "./recipients";
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

  return program.methods
    .buySolTickets(count)
    .accounts({
      buyer: wallet.publicKey,
      draw: draw.draw,
      prizeVault: draw.prizeVault,
      globalConfig,
      teamVault: vaults.teamVault,
      buxVault: vaults.buxVault,
      partnerVault1: new PublicKey(LOTTERY_PARTNER_VAULT_1),
      partnerVault2: new PublicKey(LOTTERY_PARTNER_VAULT_2),
      setupVault: vaults.setupVault,
    })
    .remainingAccounts(remainingAccounts)
    .transaction();
}

/** Fee wallets must exist on-chain before SOL buys (program credits lamports directly). */
async function preflightFeeRecipientAccounts(
  vaults: LotteryVaultPubkeys,
  accountExists?: (address: PublicKey) => Promise<boolean>,
): Promise<void> {
  if (!accountExists) return;

  const recipients: { label: string; pubkey: PublicKey }[] = [
    { label: "Team vault", pubkey: vaults.teamVault },
    { label: "BUX vault", pubkey: vaults.buxVault },
    { label: "Setup vault", pubkey: vaults.setupVault },
    {
      label: "Partner vault 1",
      pubkey: new PublicKey(LOTTERY_PARTNER_VAULT_1),
    },
    {
      label: "Partner vault 2",
      pubkey: new PublicKey(LOTTERY_PARTNER_VAULT_2),
    },
  ];

  for (const { label, pubkey } of recipients) {
    if (await accountExists(pubkey)) continue;
    throw new BuyPreflightError(
      `${label} (${pubkey.toBase58()}) has no on-chain account. Send ~0.001 SOL to that address once on mainnet, then retry.`,
    );
  }
}

/** Client-side checks before opening Phantom. */
export async function preflightBuySolTickets(
  connection: Connection,
  wallet: AnchorWallet,
  programId: PublicKey,
  draw: LotteryDrawView,
  count: number,
  nowSecFromUi?: number,
  fetchSolBalance?: (owner: PublicKey) => Promise<number>,
  vaults?: LotteryVaultPubkeys,
  accountExists?: (address: PublicKey) => Promise<boolean>,
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

  if (vaults) {
    await preflightFeeRecipientAccounts(vaults, accountExists);
  }

  const required =
    count * LAMPORTS_PER_SOL_TICKET + LAMPORTS_SOL_BUY_FEE_BUFFER;
  try {
    const balance = fetchSolBalance
      ? await fetchSolBalance(wallet.publicKey)
      : await connection.getBalance(wallet.publicKey, "confirmed");
    if (balance < required) {
      throw new BuyPreflightError(
        `Need ~${(required / 1e9).toFixed(4)} SOL for ${count} ticket(s) + network fee (wallet has ${(balance / 1e9).toFixed(4)} SOL).`,
      );
    }
  } catch (e) {
    if (e instanceof BuyPreflightError) throw e;
    // Browser cannot read balance on public RPC (403); Phantom will reject if underfunded.
  }
}
