import type { Connection, Transaction, TransactionSignature } from "@solana/web3.js";

/**
 * Send an Anchor-built transaction through the wallet adapter (Phantom uses
 * signAndSendTransaction internally). Avoids Blowfish "malicious dApp" heuristics
 * triggered by signTransaction + sendRawTransaction via Anchor .rpc().
 */
export type WalletSendTransaction = (
  transaction: Transaction,
  connection: Connection,
  options?: { skipPreflight?: boolean },
) => Promise<TransactionSignature>;

export async function sendTransactionViaWallet(
  connection: Connection,
  sendTransaction: WalletSendTransaction,
  buildTransaction: () => Promise<Transaction>,
): Promise<TransactionSignature> {
  const tx = await buildTransaction();
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");

  const signature = await sendTransaction(tx, connection, {
    skipPreflight: false,
  });

  await connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    "confirmed",
  );

  return signature;
}
