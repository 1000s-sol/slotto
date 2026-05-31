import {
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import type { Connection, PublicKey } from "@solana/web3.js";

/** True if `mint` is a legacy SPL Token or Token-2022 mint on this cluster. */
export async function mintExistsOnCluster(
  connection: Connection,
  mint: PublicKey,
): Promise<boolean> {
  const info = await connection.getAccountInfo(mint);
  if (!info) return false;
  return (
    info.owner.equals(TOKEN_PROGRAM_ID) ||
    info.owner.equals(TOKEN_2022_PROGRAM_ID)
  );
}
