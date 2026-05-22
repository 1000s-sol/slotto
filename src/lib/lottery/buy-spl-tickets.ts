import type { AnchorWallet } from "@solana/wallet-adapter-react";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { Connection, PublicKey } from "@solana/web3.js";

import type { LotteryDrawView } from "./chain";
import { MAX_SOL_TICKETS_PER_BUY } from "./constants";
import { globalConfigPda, ticketChunkPda } from "./pdas";
import { createLotteryProgram } from "./program";
import { ticketChunkIndicesForRange } from "./ticket-chunks";

export async function buySplTickets(
  connection: Connection,
  wallet: AnchorWallet,
  programId: PublicKey,
  draw: LotteryDrawView,
  mint: PublicKey,
  count: number,
): Promise<string> {
  if (!Number.isInteger(count) || count < 1 || count > MAX_SOL_TICKETS_PER_BUY) {
    throw new Error(`Buy 1–${MAX_SOL_TICKETS_PER_BUY} tickets per transaction.`);
  }

  const program = createLotteryProgram(connection, wallet);
  const globalConfig = globalConfigPda(programId);
  const cfg = await program.account.globalConfig.fetch(globalConfig);

  const [splVaultAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from("spl_vault_auth"), draw.draw.toBuffer()],
    programId,
  );

  const buyerToken = getAssociatedTokenAddressSync(
    mint,
    wallet.publicKey,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  const treasuryToken = getAssociatedTokenAddressSync(
    mint,
    splVaultAuthority,
    true,
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

  return program.methods
    .buySplTickets(count)
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
    .rpc();
}
