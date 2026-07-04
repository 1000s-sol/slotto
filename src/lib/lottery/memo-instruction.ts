import {
  PublicKey,
  TransactionInstruction,
} from "@solana/web3.js";

const MEMO_PROGRAM_ID = new PublicKey(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
);

/** Human-readable label shown in explorers / some wallets (max ~566 bytes). */
export function slottoMemoInstruction(
  signer: PublicKey,
  text: string,
): TransactionInstruction {
  const data = Buffer.from(text.slice(0, 566), "utf8");
  return new TransactionInstruction({
    keys: [{ pubkey: signer, isSigner: true, isWritable: false }],
    programId: MEMO_PROGRAM_ID,
    data,
  });
}
