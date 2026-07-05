import type { AnchorWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";

import { fetchAccountExistsClient } from "./fetch-account-exists-client";
import { fetchMintTokenProgramClient } from "./fetch-mint-token-program-client";
import { fetchTokenBalanceClient } from "./fetch-token-balance-client";
import { simulateTransactionClient } from "./simulate-transaction-client";
import type { LotteryWalletSendOpts } from "./wallet-send-transaction";

async function fetchSolBalanceClient(owner: PublicKey): Promise<number> {
  const res = await fetch(
    `/api/lottery/sol-balance?owner=${owner.toBase58()}`,
    { cache: "no-store" },
  );
  const json = (await res.json()) as { lamports?: number; error?: string };
  if (!res.ok || json.lamports == null) {
    throw new Error(json.error ?? "Could not read SOL balance");
  }
  return json.lamports;
}

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isOnChainFailureError(error: string | null): boolean {
  if (!error) return false;
  if (error === "Confirmation timed out") return false;
  if (error === "Confirm request failed") return false;
  return error.startsWith("{") || error.startsWith("[");
}

/** Retry short server polls — avoids Vercel killing one long 60s function. */
async function confirmSignatureOnServer(
  signature: string,
): Promise<{ confirmed: boolean; error: string | null }> {
  const deadline = Date.now() + 90_000;
  let lastError: string | null = null;

  while (Date.now() < deadline) {
    try {
      const res = await fetch("/api/lottery/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signature, maxWaitMs: 8_000 }),
      });
      if (!res.ok) {
        lastError = "Confirm request failed";
        await sleep(2_000);
        continue;
      }
      const result = (await res.json()) as {
        confirmed: boolean;
        error: string | null;
      };
      if (result.confirmed) {
        return result;
      }
      if (isOnChainFailureError(result.error)) {
        return result;
      }
      lastError = result.error;
    } catch {
      lastError = "Confirm request failed";
    }
    await sleep(1_500);
  }

  return {
    confirmed: false,
    error: lastError ?? "Confirmation timed out",
  };
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
        tokenProgram: snap.tokenProgram
          ? new PublicKey(snap.tokenProgram)
          : undefined,
      };
    },
    resolveTokenProgram: fetchMintTokenProgramClient,
    fetchSolBalance: fetchSolBalanceClient,
    tokenAccountExists: fetchAccountExistsClient,
    simulateBeforeSign: simulateTransactionClient,
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
