import type { AnchorWallet } from "@solana/wallet-adapter-react";
import type {
  Connection,
  Transaction,
  TransactionSignature,
} from "@solana/web3.js";

export type WalletSendTransaction = (
  transaction: Transaction,
  connection: Connection,
  options?: { skipPreflight?: boolean },
) => Promise<TransactionSignature>;

export type BlockhashBundle = {
  blockhash: string;
  lastValidBlockHeight: number;
};

export type LotteryWalletSendOpts = {
  sendTransaction?: WalletSendTransaction;
  /** Sign in Phantom, then broadcast without Phantom's RPC (server or local Connection). */
  signAndSendRaw?: boolean;
  /** Blockhash from server RPC instead of browser Connection. */
  fetchBlockhash?: () => Promise<BlockhashBundle>;
  /** Broadcast signed bytes (e.g. POST /api/lottery/send-transaction). */
  broadcastRawTransaction?: (raw: Uint8Array) => Promise<TransactionSignature>;
  /**
   * Confirm the signature server-side (Helius) instead of in the browser.
   * Required when the browser RPC is public Solana (403s confirmation polling).
   */
  confirmSignature?: (
    signature: string,
  ) => Promise<{ confirmed: boolean; error: string | null }>;
  /** Skip RPC simulate when provider returns 403 on preflight. */
  skipPreflight?: boolean;
};

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return String(error);
}

function isWalletRejectedMessage(msg: string): boolean {
  const lower = msg.toLowerCase();
  return (
    lower.includes("user rejected") ||
    lower.includes("user denied") ||
    lower.includes("user declined") ||
    lower.includes("rejected the request") ||
    lower.includes("transaction cancelled") ||
    lower.includes("transaction canceled") ||
    lower.includes("request cancelled") ||
    lower.includes("request canceled") ||
    lower.includes("approval denied") ||
    lower.includes("4001")
  );
}

/**
 * Build and send via wallet. Default: wallet-adapter `sendTransaction` (Phantom sign-and-send).
 * Admin (`signAndSendRaw`): sign in wallet, `sendRawTransaction` on our Connection (no Phantom RPC).
 */
export async function sendTransactionViaWallet(
  connection: Connection,
  wallet: AnchorWallet,
  buildTransaction: () => Promise<Transaction>,
  opts?: LotteryWalletSendOpts,
): Promise<TransactionSignature> {
  const tx = await buildTransaction();
  const { blockhash, lastValidBlockHeight } = opts?.fetchBlockhash
    ? await opts.fetchBlockhash()
    : await connection.getLatestBlockhash("confirmed");

  tx.recentBlockhash = blockhash;
  tx.feePayer = wallet.publicKey;

  const confirm = async (signature: TransactionSignature) => {
    if (opts?.confirmSignature) {
      const result = await opts.confirmSignature(signature);
      if (!result.confirmed) {
        throw new Error(
          result.error
            ? `Transaction not confirmed: ${result.error}`
            : "Transaction not confirmed.",
        );
      }
      return signature;
    }
    await connection.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight },
      "confirmed",
    );
    return signature;
  };

  if (opts?.signAndSendRaw) {
    try {
      const signed = await wallet.signTransaction(tx);
      const raw = signed.serialize();
      const signature = opts.broadcastRawTransaction
        ? await opts.broadcastRawTransaction(raw)
        : await connection.sendRawTransaction(raw, {
            skipPreflight: opts.skipPreflight ?? true,
            maxRetries: 3,
          });
      return confirm(signature);
    } catch (e) {
      if (isWalletRejectedMessage(errorText(e))) throw e;
      throw e;
    }
  }

  if (!opts?.sendTransaction) {
    throw new Error(
      "Wallet send is unavailable. Hard refresh, reconnect Phantom on Mainnet Beta, then try again.",
    );
  }

  try {
    const signature = await opts.sendTransaction(tx, connection, {
      skipPreflight: opts.skipPreflight ?? false,
    });
    return confirm(signature);
  } catch (e) {
    if (isWalletRejectedMessage(errorText(e))) {
      throw e;
    }
    throw e;
  }
}
