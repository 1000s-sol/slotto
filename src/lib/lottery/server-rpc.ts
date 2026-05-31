import { Connection } from "@solana/web3.js";

import { lotteryRpcErrorText } from "./user-facing-error";
import {
  isRpcFallbackError,
  isRpcRateLimitError,
  lotteryPublicRpcFallback,
  resolveLotteryRpcUrl,
} from "./rpc-url";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Server actions / API: primary RPC (Helius), brief backoff, then public cluster. */
export async function withLotteryServerRpc<T>(
  fn: (connection: Connection) => Promise<T>,
): Promise<T> {
  const primaryUrl = resolveLotteryRpcUrl();
  const fallbackUrl = lotteryPublicRpcFallback();

  async function run(url: string): Promise<T> {
    const connection = new Connection(url, "confirmed");
    return fn(connection);
  }

  try {
    return await run(primaryUrl);
  } catch (e) {
    const message = lotteryRpcErrorText(e);

    if (isRpcRateLimitError(message)) {
      await sleep(2500);
      try {
        return await run(primaryUrl);
      } catch (retryErr) {
        const retryMsg = lotteryRpcErrorText(retryErr);
        if (fallbackUrl !== primaryUrl && isRpcFallbackError(retryMsg)) {
          console.warn(
            "[lottery rpc] rate limited on primary — using public cluster fallback",
          );
          return run(fallbackUrl);
        }
        throw retryErr;
      }
    }

    if (fallbackUrl !== primaryUrl && isRpcFallbackError(message)) {
      console.warn("[lottery rpc] primary RPC failed — using public cluster fallback");
      return run(fallbackUrl);
    }
    throw e;
  }
}
