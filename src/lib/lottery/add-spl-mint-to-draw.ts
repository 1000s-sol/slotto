import { BN } from "@coral-xyz/anchor";
import type { AnchorWallet } from "@solana/wallet-adapter-react";
import { Connection, PublicKey } from "@solana/web3.js";

import { globalConfigPda } from "./pdas";
import { createLotteryProgram } from "./program";
import { splMintDraftToOnChainArg } from "./project-tokens-for-draw";
import type { SplMintDraft } from "./spl-types";
import {
  sendTransactionViaWallet,
  type WalletSendTransaction,
} from "./wallet-send-transaction";

export async function addSplMintToDraw(
  connection: Connection,
  wallet: AnchorWallet,
  programId: PublicKey,
  draw: PublicKey,
  row: SplMintDraft,
  sendTransaction: WalletSendTransaction,
): Promise<string> {
  const program = createLotteryProgram(connection, wallet);
  const globalConfig = globalConfigPda(programId);

  const arg = splMintDraftToOnChainArg(row);
  return sendTransactionViaWallet(connection, sendTransaction, () =>
    program.methods
      .addSplMintToDraw({
        mint: new PublicKey(arg.mint),
        pricePerTicket: new BN(arg.pricePerTicket),
        mintDecimals: arg.mintDecimals,
        cap: arg.cap,
        pricingMode: arg.pricingMode,
      })
      .accounts({
        authority: wallet.publicKey,
        globalConfig,
        draw,
      })
      .transaction(),
  );
}
