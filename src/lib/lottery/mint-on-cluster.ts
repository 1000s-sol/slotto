import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import type { Connection, PublicKey } from "@solana/web3.js";

/** True if `mint` is a token mint account on the wallet's current cluster. */
export async function mintExistsOnCluster(
  connection: Connection,
  mint: PublicKey,
): Promise<boolean> {
  const info = await connection.getAccountInfo(mint);
  if (!info) return false;
  return info.owner.equals(TOKEN_PROGRAM_ID);
}
