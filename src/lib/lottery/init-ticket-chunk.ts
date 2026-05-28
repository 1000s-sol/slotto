import type { AnchorWallet } from "@solana/wallet-adapter-react";
import { Connection, PublicKey, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";

import { globalConfigPda, ticketChunkPda } from "./pdas";
import { createLotteryProgram } from "./program";

/** Authority-only: fund ticket-chunk PDA rent before sales cross chunk boundaries. */
export async function initTicketChunk(
  connection: Connection,
  wallet: AnchorWallet,
  programId: PublicKey,
  draw: PublicKey,
  chunkIndex: number,
): Promise<string> {
  if (!Number.isInteger(chunkIndex) || chunkIndex < 0) {
    throw new Error("chunkIndex must be a non-negative integer");
  }

  const program = createLotteryProgram(connection, wallet);
  const ticketChunk = ticketChunkPda(programId, draw, chunkIndex);

  return program.methods
    .initTicketChunk(chunkIndex)
    .accounts({
      authority: wallet.publicKey,
      globalConfig: globalConfigPda(programId),
      draw,
      ticketChunk,
      systemProgram: new PublicKey("11111111111111111111111111111111"),
      rent: SYSVAR_RENT_PUBKEY,
    })
    .rpc();
}
