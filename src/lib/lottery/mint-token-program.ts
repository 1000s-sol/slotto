import {
  getAssociatedTokenAddressSync,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import type { Connection, PublicKey } from "@solana/web3.js";

import { mintLotteryBuySupportedCached } from "./mint-program-cache";

/** SPL Token and Token-2022 mints are supported for `buy_spl_tickets`. */
export function isLotterySplBuySupportedProgram(
  program: PublicKey,
): boolean {
  return (
    program.equals(TOKEN_PROGRAM_ID) || program.equals(TOKEN_2022_PROGRAM_ID)
  );
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
  return mintLotteryBuySupportedCached(connection, mint);
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
