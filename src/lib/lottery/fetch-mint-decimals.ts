import { Connection, PublicKey } from "@solana/web3.js";

import { isRpcAuthError, LOTTERY_PUBLIC_MAINNET_RPC } from "./rpc-url";
import { lotteryRpcErrorText } from "./user-facing-error";

function metadataRpcUrl(): string {
  const explicit = process.env.LOTTERY_METADATA_RPC_URL?.trim();
  if (explicit) return explicit;
  return LOTTERY_PUBLIC_MAINNET_RPC;
}

/** Mint decimals for pricing preview (mainnet mints while testing on devnet). */
export async function fetchMintDecimals(mint: string): Promise<number> {
  const primaryUrl = metadataRpcUrl();
  const read = async (url: string) => {
    const connection = new Connection(url, "confirmed");
    return connection.getParsedAccountInfo(new PublicKey(mint));
  };
  let info;
  try {
    info = await read(primaryUrl);
  } catch (e) {
    const message = lotteryRpcErrorText(e);
    const fallback = LOTTERY_PUBLIC_MAINNET_RPC;
    if (primaryUrl !== fallback && isRpcAuthError(message)) {
      info = await read(fallback);
    } else {
      throw e;
    }
  }
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
