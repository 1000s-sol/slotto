import type { AnchorWallet } from "@solana/wallet-adapter-react";
import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Connection, PublicKey } from "@solana/web3.js";

import { globalConfigPda } from "./pdas";
import { createLotteryProgram } from "./program";

/** Authority pays team-wallet ATA rent for one SPL mint before sales. */
export async function ensureTeamTokenAta(
  connection: Connection,
  wallet: AnchorWallet,
  programId: PublicKey,
  mint: PublicKey,
): Promise<string> {
  const program = createLotteryProgram(connection, wallet);
  const globalConfig = globalConfigPda(programId);
  const cfg = await program.account.globalConfig.fetch(globalConfig);
  const teamVault = cfg.teamVault;
  const teamToken = getAssociatedTokenAddressSync(
    mint,
    teamVault,
    false,
    TOKEN_PROGRAM_ID,
  );

  return program.methods
    .ensureTeamTokenAta()
    .accountsPartial({
      authority: wallet.publicKey,
      globalConfig,
      mint,
      teamVault,
      teamToken,
    })
    .rpc();
}
