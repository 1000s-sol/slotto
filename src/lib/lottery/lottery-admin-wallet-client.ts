"use client";

import type { AnchorWallet } from "@solana/wallet-adapter-react";

import {
  adminBroadcastSignedTransactionAction,
  adminFetchRecentBlockhashAction,
} from "@/app/admin/(dashboard)/lotteries/actions";

import { confirmSignatureViaApi } from "./confirm-signature-client";
import { fetchMintTokenProgramClient } from "./fetch-mint-token-program-client";
import type { LotteryWalletSendOpts } from "./wallet-send-transaction";

/** Admin on-chain txs: server RPC with Helius + public fallback (never browser RPC). */
export function lotteryWalletSendOptsForAdmin(
  wallet: AnchorWallet,
): LotteryWalletSendOpts {
  void wallet;
  return {
    fetchBlockhash: adminFetchRecentBlockhashAction,
    confirmSignature: (signature) =>
      confirmSignatureViaApi(signature, 120_000),
    signAndSendRaw: true,
    broadcastRawTransaction: async (raw) => {
      const { signature } = await adminBroadcastSignedTransactionAction(
        Buffer.from(raw).toString("base64"),
      );
      return signature;
    },
    resolveTokenProgram: fetchMintTokenProgramClient,
  };
}
