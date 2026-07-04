import type { AnchorWallet } from "@solana/wallet-adapter-react";
import {
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Connection, PublicKey } from "@solana/web3.js";

import { globalConfigPda } from "./pdas";
import {
  buyerAssociatedTokenAddress,
  resolveMintTokenProgram,
} from "./mint-token-program";
import { createLotteryProgram } from "./program";
import {
  sendTransactionViaWallet,
  type LotteryWalletSendOpts,
} from "./wallet-send-transaction";

/** Authority pays team-wallet ATA rent for one SPL mint before sales. */
export async function ensureTeamTokenAta(
  connection: Connection,
  wallet: AnchorWallet,
  programId: PublicKey,
  mint: PublicKey,
  sendOpts?: LotteryWalletSendOpts,
  teamVault?: PublicKey,
): Promise<string> {
  const program = createLotteryProgram(connection, wallet);
  const globalConfig = globalConfigPda(programId);
  let teamVaultPk = teamVault;
  if (!teamVaultPk) {
    const cfg = await program.account.globalConfig.fetch(globalConfig);
    teamVaultPk = cfg.teamVault;
  }
  const tokenProgram = sendOpts?.resolveTokenProgram
    ? await sendOpts.resolveTokenProgram(mint)
    : ((await resolveMintTokenProgram(connection, mint)) ?? TOKEN_PROGRAM_ID);
  const teamToken = buyerAssociatedTokenAddress(mint, teamVaultPk, tokenProgram);

  return sendTransactionViaWallet(connection, wallet, () =>
    program.methods
      .ensureTeamTokenAta()
      .accountsPartial({
        authority: wallet.publicKey,
        globalConfig,
        mint,
        teamVault: teamVaultPk,
        teamToken,
        tokenProgram,
      })
      .transaction(),
    sendOpts,
  );
}
