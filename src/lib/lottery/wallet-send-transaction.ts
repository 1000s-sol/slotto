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
};

/**
 * Sign with the connected wallet (Phantom popup), then broadcast.
 * Uses adapter.signTransaction when available — avoids adapter sendTransaction
 * paths that return "No signers" without opening the wallet.
 */
export async function sendTransactionViaWallet(
  connection: Connection,
  wallet: AnchorWallet,
  buildTransaction: () => Promise<Transaction>,
  _opts?: LotteryWalletSendOpts,
): Promise<TransactionSignature> {
  const tx = await buildTransaction();
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");

  tx.recentBlockhash = blockhash;
  tx.feePayer = wallet.publicKey;

  const signed = await wallet.signTransaction(tx);
  const signature = await connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: false,
  });
  await connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    "confirmed",
  );
  return signature;
}
