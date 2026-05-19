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

  // IDL includes `add_spl_mint_to_draw` after program upgrade; types catch up on regen.
  return (
    program.methods as {
      addSplMintToDraw: (args: {
        mint: PublicKey;
        pricePerTicket: BN;
        mintDecimals: number;
        cap: number;
      }) => {
        accounts: (a: object) => { rpc: () => Promise<string> };
      };
    }
  )
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
