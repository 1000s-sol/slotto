import { BN } from "@coral-xyz/anchor";
import type { AnchorWallet } from "@solana/wallet-adapter-react";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Connection, PublicKey } from "@solana/web3.js";

import type { LotteryDrawView } from "./chain";
import {
  LAMPORTS_SOL_BUY_FEE_BUFFER,
  MAX_SOL_TICKETS_PER_BUY,
} from "./constants";
import {
  buyerAssociatedTokenAddress,
  resolveMintTokenProgram,
} from "./mint-token-program";
import { globalConfigPda, ticketChunkPda } from "./pdas";
import { BuyPreflightError, type LotteryVaultPubkeys } from "./preflight-buy-sol";
import { createLotteryProgram } from "./program";
import { isRpcRateLimitError } from "./rpc-url";
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
  vaults: LotteryVaultPubkeys,
  sendOpts?: LotteryWalletSendOpts,
  tokenLabel?: string,
): Promise<string> {
  if (!Number.isInteger(count) || count < 1 || count > MAX_SOL_TICKETS_PER_BUY) {
    throw new Error(`Buy 1–${MAX_SOL_TICKETS_PER_BUY} tickets per transaction.`);
  }

  const label = tokenLabel?.trim() || "tokens";
  const tokenProgram =
    (await resolveMintTokenProgram(connection, mint)) ?? TOKEN_PROGRAM_ID;

  const program = createLotteryProgram(connection, wallet);
  const globalConfig = globalConfigPda(programId);
  const teamVault = vaults.teamVault;

  const buyerToken = buyerAssociatedTokenAddress(
    mint,
    wallet.publicKey,
    tokenProgram,
  );

  // Preflight before opening the wallet: a transaction that the wallet's
  // simulator can't cover (no/low token balance, or no SOL for the network
  // fee) gets flagged as "malicious / request blocked". Catch it here with a
  // plain message so Phantom never sees a failing simulation.
  const chainRow = draw.splMints.find((r) => r.mint === mint.toBase58());
  const decimals = chainRow?.decimals ?? 0;
  const required = quotedPricePerTicket * BigInt(count);

  let ataHeld = BigInt(0);
  let totalHeld = BigInt(0);
  if (sendOpts?.fetchTokenBalance) {
    try {
      const bal = await sendOpts.fetchTokenBalance(wallet.publicKey, mint);
      ataHeld = bal.ata;
      totalHeld = bal.total;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (isRpcRateLimitError(msg) || /too many requests/i.test(msg)) {
        // Helius 429 — do not block Phantom; wallet simulation will catch underfunding.
      } else {
        throw new BuyPreflightError(
          `Could not verify your ${label} balance. Refresh the page and try again.`,
        );
      }
    }
  } else {
    try {
      const bal = await connection.getTokenAccountBalance(buyerToken, "confirmed");
      ataHeld = BigInt(bal.value.amount);
      totalHeld = ataHeld;
    } catch {
      // Browser RPC often 403 — skip hard fail; Phantom will reject if underfunded.
    }
  }

  const heldForTx = ataHeld;
  const heldDisplay = totalHeld > ataHeld ? totalHeld : ataHeld;

  if (heldForTx < required) {
    if (heldForTx === BigInt(0) && totalHeld === BigInt(0)) {
      // Server balance read often returns empty under Helius 429 — let the wallet verify.
    } else if (totalHeld >= required) {
      throw new BuyPreflightError(
        `Your wallet holds ${splBaseUnitsToUi(totalHeld.toString(), decimals)} ${label}, but the token account used for ticket buys only has ${splBaseUnitsToUi(ataHeld.toString(), decimals)} ${label}. Open your wallet, select ${label}, and consolidate or receive tokens into your main account, then try again.`,
      );
    } else {
      throw new BuyPreflightError(
        `You need ${splBaseUnitsToUi(required.toString(), decimals)} ${label} for ${count} ticket(s), but this wallet holds ${splBaseUnitsToUi(heldDisplay.toString(), decimals)} ${label}. Add ${label} to your wallet and try again.`,
      );
    }
  }

  try {
    const solBalance = await connection.getBalance(wallet.publicKey, "confirmed");
    if (solBalance < LAMPORTS_SOL_BUY_FEE_BUFFER) {
      throw new BuyPreflightError(
        `This wallet needs a little SOL for the network fee (about ${(LAMPORTS_SOL_BUY_FEE_BUFFER / 1e9).toFixed(4)} SOL). Add some SOL and try again.`,
      );
    }
  } catch (e) {
    if (e instanceof BuyPreflightError) throw e;
  }
  const teamToken = buyerAssociatedTokenAddress(mint, teamVault, tokenProgram);

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
        setupVault: vaults.setupVault,
        tokenProgram,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .remainingAccounts(remainingAccounts)
      .transaction(),
    sendOpts,
  );
}
