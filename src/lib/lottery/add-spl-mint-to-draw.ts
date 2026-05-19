import { BN } from "@coral-xyz/anchor";
import type { AnchorWallet } from "@solana/wallet-adapter-react";
import { Connection, PublicKey } from "@solana/web3.js";

import { globalConfigPda } from "./pdas";
import { createLotteryProgram } from "./program";
import type { SplMintDraft } from "./spl-types";

export async function addSplMintToDraw(
  connection: Connection,
  wallet: AnchorWallet,
  programId: PublicKey,
  draw: PublicKey,
  row: SplMintDraft,
): Promise<string> {
  const program = createLotteryProgram(connection, wallet);
  const globalConfig = globalConfigPda(programId);

  return program.methods
    .addSplMintToDraw({
      mint: new PublicKey(row.mint),
      pricePerTicket: new BN(row.pricePerTicket),
      mintDecimals: row.mintDecimals,
      cap: row.onChainCap,
    })
    .accounts({
      authority: wallet.publicKey,
      globalConfig,
      draw,
    })
    .rpc();
}
