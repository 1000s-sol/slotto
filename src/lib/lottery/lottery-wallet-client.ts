import type { AnchorWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";

import { fetchTokenBalanceClient } from "./fetch-token-balance-client";
import type { LotteryWalletSendOpts } from "./wallet-send-transaction";

async function fetchServerBlockhash(): Promise<{
  blockhash: string;
  lastValidBlockHeight: number;
}> {
  const res = await fetch("/api/lottery/blockhash", { cache: "no-store" });
  if (!res.ok) {
    throw new Error("Could not fetch blockhash from server");
  }
  return res.json() as Promise<{
    blockhash: string;
    lastValidBlockHeight: number;
  }>;
}

async function confirmSignatureOnServer(
  signature: string,
): Promise<{ confirmed: boolean; error: string | null }> {
  const res = await fetch("/api/lottery/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ signature }),
  });
  if (!res.ok) {
    return { confirmed: false, error: "Confirm request failed" };
  }
  return res.json() as Promise<{ confirmed: boolean; error: string | null }>;
}

async function broadcastSignedTransactionOnServer(
  raw: Uint8Array,
): Promise<string> {
  const res = await fetch("/api/lottery/send-transaction", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      transaction: Buffer.from(raw).toString("base64"),
    }),
  });
  const json = (await res.json()) as { signature?: string; error?: string };
  if (!res.ok || !json.signature) {
    throw new Error(json.error ?? "Could not broadcast transaction");
  }
  return json.signature;
}

/**
 * Browser lottery txs: server blockhash + confirm, sign in Phantom, broadcast via
 * server Helius. Works when Wallet Standard omits `sendTransaction` (Phantom still
 * exposes `signTransaction`).
 */
export function lotteryWalletSendOptsForBrowser(
  wallet: AnchorWallet,
  sendTransaction?: LotteryWalletSendOpts["sendTransaction"],
): LotteryWalletSendOpts {
  void sendTransaction;
  return {
    fetchBlockhash: fetchServerBlockhash,
    confirmSignature: confirmSignatureOnServer,
    signAndSendRaw: true,
    broadcastRawTransaction: broadcastSignedTransactionOnServer,
    fetchTokenBalance: async (owner: PublicKey, mint: PublicKey) => {
      const snap = await fetchTokenBalanceClient(owner, mint);
      return {
        ata: BigInt(snap.amount),
        total: BigInt(snap.totalAmount),
      };
    },
  };
}

/** @deprecated Use lotteryWalletSendOptsForBrowser(wallet, sendTransaction). */
export function lotteryWalletSendOptsFromApi(
  sendTransaction: LotteryWalletSendOpts["sendTransaction"],
): LotteryWalletSendOpts {
  return {
    sendTransaction,
    fetchBlockhash: fetchServerBlockhash,
    confirmSignature: confirmSignatureOnServer,
  };
}
