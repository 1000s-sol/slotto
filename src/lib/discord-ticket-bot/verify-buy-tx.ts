import type { Connection } from "@solana/web3.js";
import { PublicKey } from "@solana/web3.js";

/** Confirmed lottery buy tx references the program and buyer signed. */
export async function verifyLotteryBuySignature(
  connection: Connection,
  signature: string,
  programId: PublicKey,
  buyerWallet: string,
): Promise<boolean> {
  const status = await connection.getSignatureStatus(signature, {
    searchTransactionHistory: true,
  });
  const value = status.value;
  if (!value || value.err) return false;
  const level = value.confirmationStatus;
  if (level !== "confirmed" && level !== "finalized") return false;

  const tx = await connection.getTransaction(signature, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });
  if (!tx?.meta || tx.meta.err) return false;

  const keys = tx.transaction.message.getAccountKeys({
    accountKeysFromLookups: tx.meta.loadedAddresses,
  });
  const programStr = programId.toBase58();
  let hasProgram = false;
  for (let i = 0; i < keys.length; i += 1) {
    if (keys.get(i)?.toBase58() === programStr) {
      hasProgram = true;
      break;
    }
  }
  if (!hasProgram) return false;

  const buyer = new PublicKey(buyerWallet);
  const numSigners = tx.transaction.message.header.numRequiredSignatures;
  let buyerSigned = false;
  for (let i = 0; i < numSigners; i += 1) {
    if (keys.get(i)?.equals(buyer)) {
      buyerSigned = true;
      break;
    }
  }
  if (!buyerSigned) return false;

  const logs = tx.meta.logMessages ?? [];
  const buyLog = logs.some(
    (line) =>
      /Instruction:\s*Buy(Sol|Spl)Tickets/i.test(line) ||
      /buy_(sol|spl)_tickets/i.test(line),
  );
  return buyLog;
}
