import type {
  Connection,
  PublicKey,
  Transaction,
  TransactionSignature,
} from "@solana/web3.js";

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
  feePayer: PublicKey,
): Promise<TransactionSignature> {
  const tx = await buildTransaction();
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");

  tx.recentBlockhash = blockhash;
  tx.feePayer = feePayer;

  const signature = await sendTransaction(tx, connection, {
    skipPreflight: false,
  });

  await connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    "confirmed",
  );

  return signature;
}
