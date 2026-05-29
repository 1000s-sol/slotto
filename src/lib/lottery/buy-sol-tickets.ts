import type { AnchorWallet } from "@solana/wallet-adapter-react";
import { Connection, PublicKey } from "@solana/web3.js";

import { MAX_SOL_TICKETS_PER_BUY } from "./constants";
import { globalConfigPda, ticketChunkPda } from "./pdas";
import { createLotteryProgram } from "./program";
import { ticketChunkIndicesForRange } from "./ticket-chunks";
import type { LotteryDrawView } from "./chain";
import { preflightBuySolTickets } from "./preflight-buy-sol";

export async function buySolTickets(
  connection: Connection,
  wallet: AnchorWallet,
  programId: PublicKey,
  draw: LotteryDrawView,
  count: number,
): Promise<string> {
  if (!Number.isInteger(count) || count < 1 || count > MAX_SOL_TICKETS_PER_BUY) {
    throw new Error(`Buy 1–${MAX_SOL_TICKETS_PER_BUY} tickets per transaction.`);
  }

  await preflightBuySolTickets(connection, wallet, programId, draw, count);

  const program = createLotteryProgram(connection, wallet);
  const globalConfig = globalConfigPda(programId);
  const cfg = await program.account.globalConfig.fetch(globalConfig);

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
      teamVault: cfg.teamVault,
      buxVault: cfg.buxVault,
      setupVault: cfg.setupVault,
    })
    .remainingAccounts(remainingAccounts)
    .rpc();
}
