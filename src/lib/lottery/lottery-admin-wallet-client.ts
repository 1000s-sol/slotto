"use client";

import type { AnchorWallet } from "@solana/wallet-adapter-react";

import { confirmSignatureViaApi } from "./confirm-signature-client";
import { fetchMintTokenProgramClient } from "./fetch-mint-token-program-client";
import type { LotteryWalletSendOpts } from "./wallet-send-transaction";

/**
 * Admin on-chain txs — same HTTP relays as ticket buys.
 * Do NOT use server actions here: production digests hide the real RPC/broadcast error.
 */
export function lotteryWalletSendOptsForAdmin(
  wallet: AnchorWallet,
): LotteryWalletSendOpts {
  void wallet;
  return {
    fetchBlockhash: async () => {
      const res = await fetch("/api/lottery/blockhash", { cache: "no-store" });
      const json = (await res.json()) as {
        blockhash?: string;
        lastValidBlockHeight?: number;
        error?: string;
      };
      if (!res.ok || !json.blockhash || json.lastValidBlockHeight == null) {
        throw new Error(json.error || `Blockhash failed (HTTP ${res.status})`);
      }
      return {
        blockhash: json.blockhash,
        lastValidBlockHeight: json.lastValidBlockHeight,
      };
    },
    confirmSignature: (signature) =>
      confirmSignatureViaApi(signature, 45_000),
    signAndSendRaw: true,
    broadcastRawTransaction: async (raw) => {
      const res = await fetch("/api/lottery/send-transaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transaction: Buffer.from(raw).toString("base64"),
        }),
      });
      const json = (await res.json()) as {
        signature?: string;
        error?: string;
      };
      if (!res.ok || !json.signature) {
        throw new Error(json.error || `Broadcast failed (HTTP ${res.status})`);
      }
      return json.signature;
    },
    resolveTokenProgram: fetchMintTokenProgramClient,
  };
}
