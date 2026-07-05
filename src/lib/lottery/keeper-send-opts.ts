import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import type { Connection, PublicKey } from "@solana/web3.js";

import { resolveMintTokenProgram } from "./mint-token-program";
import type { LotteryWalletSendOpts } from "./wallet-send-transaction";

/** Server keeper keypair: sign locally, broadcast + confirm on server RPC. */
export function lotteryKeeperSendOpts(connection: Connection): LotteryWalletSendOpts {
  return {
    signAndSendRaw: true,
    fetchBlockhash: async () => {
      const latest = await connection.getLatestBlockhash("confirmed");
      return {
        blockhash: latest.blockhash,
        lastValidBlockHeight: latest.lastValidBlockHeight,
      };
    },
    broadcastRawTransaction: async (raw) =>
      connection.sendRawTransaction(raw, {
        skipPreflight: false,
        maxRetries: 3,
      }),
    resolveTokenProgram: async (mint: PublicKey) =>
      (await resolveMintTokenProgram(connection, mint)) ?? TOKEN_PROGRAM_ID,
  };
}
