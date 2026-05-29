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
  /** Phantom / wallet-adapter sign-and-send (same path as create_draw — no Blowfish warning). */
  sendTransaction?: WalletSendTransaction;
  adapter?: WalletAdapter | null;
};

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return String(error);
}

/**
 * Build, sign, and send a legacy transaction.
 * Prefers wallet-adapter `sendTransaction` (Phantom signAndSend); falls back to
 * signTransaction + sendRaw only when the adapter cannot send.
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

  if (opts?.sendTransaction) {
    try {
      const signature = await opts.sendTransaction(tx, connection, {
        skipPreflight: false,
      });
      await connection.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        "confirmed",
      );
      return signature;
    } catch (e) {
      const msg = errorText(e).toLowerCase();
      if (msg.includes("user rejected") || msg.includes("user declined")) {
        throw e;
      }
      // Fall through to sign + sendRaw only for adapter signing failures.
      if (
        !msg.includes("no signers") &&
        !msg.includes("no signer") &&
        !msg.includes("not connected")
      ) {
        throw e;
      }
    }
  }

  const signed = await wallet.signTransaction(tx);
  const signature = await connection.sendRawTransaction(signed.serialize(), {
    // Unsigned-tx RPC preflight often false-flags InsufficientFundsForRent on vaults.
    skipPreflight: true,
  });
  await connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    "confirmed",
  );
  return signature;
}
