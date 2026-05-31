import type { WalletAdapter } from "@solana/wallet-adapter-base";
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

export type LotteryWalletSendOpts = {
  sendTransaction?: WalletSendTransaction;
  adapter?: WalletAdapter | null;
  /** Admin / recovery: skip RPC simulate when provider returns 403 on preflight. */
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
 * Build and send via wallet-adapter `sendTransaction` (Phantom sign-and-send).
 * Does not fall back to signTransaction + sendRaw (that path triggers Blowfish warnings).
 */
export async function sendTransactionViaWallet(
  connection: Connection,
  wallet: AnchorWallet,
  buildTransaction: () => Promise<Transaction>,
  opts?: LotteryWalletSendOpts,
): Promise<TransactionSignature> {
  const tx = await buildTransaction();
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");

  tx.recentBlockhash = blockhash;
  tx.feePayer = wallet.publicKey;

  if (!opts?.sendTransaction) {
    throw new Error(
      "Wallet send is unavailable. Refresh the page and reconnect Phantom on Mainnet Beta.",
    );
  }

  try {
    const signature = await opts.sendTransaction(tx, connection, {
      skipPreflight: opts.skipPreflight ?? false,
    });
    await connection.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight },
      "confirmed",
    );
    return signature;
  } catch (e) {
    if (isWalletRejectedMessage(errorText(e))) {
      throw e;
    }
    throw e;
  }
}
