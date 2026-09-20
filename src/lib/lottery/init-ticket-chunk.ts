import type { AnchorWallet } from "@solana/wallet-adapter-react";
import { Connection, PublicKey } from "@solana/web3.js";

import { globalConfigPda, ticketChunkPda } from "./pdas";
import { createLotteryProgram } from "./program";
import {
  sendTransactionViaWallet,
  type LotteryWalletSendOpts,
} from "./wallet-send-transaction";

/** Authority-only: fund ticket-chunk PDA rent before sales cross chunk boundaries. */
export async function initTicketChunk(
  connection: Connection,
  wallet: AnchorWallet,
  programId: PublicKey,
  draw: PublicKey,
  chunkIndex: number,
  sendOpts?: LotteryWalletSendOpts,
): Promise<string> {
  if (!Number.isInteger(chunkIndex) || chunkIndex < 0) {
    throw new Error("chunkIndex must be a non-negative integer");
  }

  const program = createLotteryProgram(connection, wallet);
  const ticketChunk = ticketChunkPda(programId, draw, chunkIndex);

  return sendTransactionViaWallet(
    connection,
    wallet,
    () =>
      program.methods
        .initTicketChunk(chunkIndex)
        .accountsPartial({
          authority: wallet.publicKey,
          globalConfig: globalConfigPda(programId),
          draw,
          ticketChunk,
        })
        .transaction(),
    sendOpts,
  );
}
