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
    fetchBlockhash: async () => {
      const res = await adminFetchRecentBlockhashAction();
      if (!res.ok) {
        throw new Error(res.error || "Could not fetch blockhash from server");
      }
      return {
        blockhash: res.blockhash,
        lastValidBlockHeight: res.lastValidBlockHeight,
      };
    },
    confirmSignature: (signature) =>
      confirmSignatureViaApi(signature, 30_000),
    signAndSendRaw: true,
    broadcastRawTransaction: async (raw) => {
      const { signature, error } = await adminBroadcastSignedTransactionAction(
        Buffer.from(raw).toString("base64"),
      ).then((res) =>
        res.ok
          ? { signature: res.signature, error: null as string | null }
          : { signature: null as string | null, error: res.error },
      );
      if (!signature) {
        throw new Error(error || "Could not broadcast transaction");
      }
      return signature;
    },
    resolveTokenProgram: fetchMintTokenProgramClient,
  };
}
