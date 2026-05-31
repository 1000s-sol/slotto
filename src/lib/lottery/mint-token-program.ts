import {
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import type { Connection, PublicKey } from "@solana/web3.js";

/** On-chain lottery `buy_spl_tickets` only supports legacy SPL Token (not Token-2022). */
export function isLotterySplBuySupportedProgram(
  program: PublicKey,
): boolean {
  return program.equals(TOKEN_PROGRAM_ID);
}

export async function resolveMintTokenProgram(
  connection: Connection,
  mint: PublicKey,
): Promise<PublicKey | null> {
  const info = await connection.getAccountInfo(mint, "confirmed");
  if (!info) return null;
  if (info.owner.equals(TOKEN_PROGRAM_ID)) return TOKEN_PROGRAM_ID;
  if (info.owner.equals(TOKEN_2022_PROGRAM_ID)) return TOKEN_2022_PROGRAM_ID;
  return null;
}

export async function mintSupportedForLotterySplBuy(
  connection: Connection,
  mint: PublicKey,
): Promise<boolean> {
  const program = await resolveMintTokenProgram(connection, mint);
  return program !== null && isLotterySplBuySupportedProgram(program);
}

export function buyerAssociatedTokenAddress(
  mint: PublicKey,
  owner: PublicKey,
  tokenProgram: PublicKey,
): PublicKey {
  return getAssociatedTokenAddressSync(
    mint,
    owner,
    false,
    tokenProgram,
  );
}
