import { Connection, PublicKey } from "@solana/web3.js";

import { LOTTERY_PUBLIC_MAINNET_RPC } from "./rpc-url";

/** Mint decimals for pricing preview (mainnet mints while testing on devnet). */
export async function fetchMintDecimals(mint: string): Promise<number> {
  const heliusKey = process.env.HELIUS_API_KEY?.trim();
  const rpc =
    process.env.LOTTERY_METADATA_RPC_URL?.trim() ||
    (heliusKey
      ? `https://mainnet.helius-rpc.com/?api-key=${heliusKey}`
      : LOTTERY_PUBLIC_MAINNET_RPC);
  const connection = new Connection(rpc, "confirmed");
  const info = await connection.getParsedAccountInfo(new PublicKey(mint));
  const parsed = info.value?.data;
  if (parsed && typeof parsed === "object" && "parsed" in parsed) {
    const decimals = (parsed.parsed as { info?: { decimals?: number } }).info
      ?.decimals;
    if (typeof decimals === "number" && decimals >= 0 && decimals <= 18) {
      return decimals;
    }
  }
  return 9;
}
