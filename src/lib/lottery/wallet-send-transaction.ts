import type { AnchorWallet } from "@solana/wallet-adapter-react";
import type {
  Connection,
  Transaction,
  TransactionSignature,
} from "@solana/web3.js";

/**
 * Build, sign with the connected wallet, and send a legacy transaction.
 * Uses signTransaction + sendRawTransaction (not adapter sendTransaction) so
 * Phantom reliably signs buyer/authority txs including buy_sol_tickets.
 */
export async function sendTransactionViaWallet(
  connection: Connection,
  wallet: AnchorWallet,
  buildTransaction: () => Promise<Transaction>,
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
