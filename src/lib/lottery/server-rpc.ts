import { Connection } from "@solana/web3.js";

import { lotteryRpcErrorText } from "./user-facing-error";
import {
  isRpcAuthError,
  lotteryPublicRpcFallback,
  resolveLotteryRpcUrl,
} from "./rpc-url";

/** Server actions / API: primary RPC (Helius), then public cluster on auth errors. */
export async function withLotteryServerRpc<T>(
  fn: (connection: Connection) => Promise<T>,
): Promise<T> {
  const primaryUrl = resolveLotteryRpcUrl();
  const primary = new Connection(primaryUrl, "confirmed");
  try {
    return await fn(primary);
  } catch (e) {
    const message = lotteryRpcErrorText(e);
    const fallbackUrl = lotteryPublicRpcFallback();
    if (fallbackUrl !== primaryUrl && isRpcAuthError(message)) {
      const fallback = new Connection(fallbackUrl, "confirmed");
      return await fn(fallback);
    }
    throw e;
  }
}
