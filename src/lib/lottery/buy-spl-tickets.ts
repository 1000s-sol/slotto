import { BN } from "@coral-xyz/anchor";
import type { AnchorWallet } from "@solana/wallet-adapter-react";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { Connection, PublicKey } from "@solana/web3.js";

import type { LotteryDrawView } from "./chain";
import {
  LAMPORTS_SOL_BUY_FEE_BUFFER,
  MAX_SOL_TICKETS_PER_BUY,
} from "./constants";
import { globalConfigPda, ticketChunkPda } from "./pdas";
import { BuyPreflightError } from "./preflight-buy-sol";
import { createLotteryProgram } from "./program";
import { splBaseUnitsToUi } from "./spl-price";
import { ticketChunkIndicesForRange } from "./ticket-chunks";
import {
  sendTransactionViaWallet,
  type LotteryWalletSendOpts,
} from "./wallet-send-transaction";

export async function buySplTickets(
  connection: Connection,
  wallet: AnchorWallet,
  programId: PublicKey,
  draw: LotteryDrawView,
  mint: PublicKey,
  count: number,
  quotedPricePerTicket: bigint,
  sendOpts?: LotteryWalletSendOpts,
  tokenLabel?: string,
): Promise<string> {
  if (!Number.isInteger(count) || count < 1 || count > MAX_SOL_TICKETS_PER_BUY) {
    throw new Error(`Buy 1–${MAX_SOL_TICKETS_PER_BUY} tickets per transaction.`);
  }

  const program = createLotteryProgram(connection, wallet);
  const globalConfig = globalConfigPda(programId);
  const cfg = await program.account.globalConfig.fetch(globalConfig);

  const teamVault = cfg.teamVault;

  const buyerToken = getAssociatedTokenAddressSync(
    mint,
    wallet.publicKey,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  // Preflight before opening the wallet: a transaction that the wallet's
  // simulator can't cover (no/low token balance, or no SOL for the network
  // fee) gets flagged as "malicious / request blocked". Catch it here with a
  // plain message so Phantom never sees a failing simulation.
  const label = tokenLabel?.trim() || "tokens";
  const chainRow = draw.splMints.find((r) => r.mint === mint.toBase58());
  const decimals = chainRow?.decimals ?? 0;
  const required = quotedPricePerTicket * BigInt(count);

  let held = BigInt(0);
  try {
    const bal = await connection.getTokenAccountBalance(buyerToken, "confirmed");
    held = BigInt(bal.value.amount);
  } catch {
    held = BigInt(0); // No associated token account yet — treat as zero balance.
  }
  if (held < required) {
    throw new BuyPreflightError(
      `You need ${splBaseUnitsToUi(required.toString(), decimals)} ${label} for ${count} ticket(s), but this wallet holds ${splBaseUnitsToUi(held.toString(), decimals)} ${label}. Add ${label} to your wallet and try again.`,
    );
  }

  const solBalance = await connection.getBalance(wallet.publicKey, "confirmed");
  if (solBalance < LAMPORTS_SOL_BUY_FEE_BUFFER) {
    throw new BuyPreflightError(
      `This wallet needs a little SOL for the network fee (about ${(LAMPORTS_SOL_BUY_FEE_BUFFER / 1e9).toFixed(4)} SOL). Add some SOL and try again.`,
    );
  }
  const teamToken = getAssociatedTokenAddressSync(
    mint,
    teamVault,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  const base = draw.totalTickets;
  const chunkIndices = ticketChunkIndicesForRange(base, count);
  const remainingAccounts = chunkIndices.map((idx) => ({
    pubkey: ticketChunkPda(programId, draw.draw, idx),
    isWritable: true,
    isSigner: false,
  }));

  return sendTransactionViaWallet(
    connection,
    wallet,
    () =>
      program.methods
      .buySplTickets(count, new BN(quotedPricePerTicket.toString()))
      .accounts({
        buyer: wallet.publicKey,
        draw: draw.draw,
        globalConfig,
        mint,
        teamVault,
        buyerToken,
        teamToken,
        setupVault: cfg.setupVault,
      })
      .remainingAccounts(remainingAccounts)
      .transaction(),
    sendOpts,
  );
}
