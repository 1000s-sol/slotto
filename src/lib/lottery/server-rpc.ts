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

function makeConnection(url: string): Connection {
  return new Connection(url, {
    commitment: "confirmed",
    disableRetryOnRateLimit: true,
  });
}

/** Server actions / API: primary RPC (Helius), brief backoff, then public cluster. */
export async function withLotteryServerRpc<T>(
  fn: (connection: Connection) => Promise<T>,
): Promise<T> {
  const primaryUrl = resolveLotteryRpcUrl();
  const fallbackUrl = lotteryPublicRpcFallback();

  async function run(url: string): Promise<T> {
    return fn(makeConnection(url));
  }

  try {
    return await run(primaryUrl);
  } catch (e) {
    const message = lotteryRpcErrorText(e);

    if (isRpcRateLimitError(message) && fallbackUrl !== primaryUrl) {
      console.warn(
        "[lottery rpc] rate limited on primary — using public cluster fallback",
      );
      try {
        return await run(fallbackUrl);
      } catch (fallbackErr) {
        const fallbackMsg = lotteryRpcErrorText(fallbackErr);
        if (!isRpcRateLimitError(fallbackMsg)) throw fallbackErr;
      }
      await sleep(1500);
      try {
        return await run(primaryUrl);
      } catch (retryErr) {
        throw retryErr;
      }
    }

    if (isRpcRateLimitError(message)) {
      await sleep(1500);
      try {
        return await run(primaryUrl);
      } catch (retryErr) {
        const retryMsg = lotteryRpcErrorText(retryErr);
        if (fallbackUrl !== primaryUrl && isRpcFallbackError(retryMsg)) {
          console.warn(
            "[lottery rpc] rate limited after retry — using public cluster fallback",
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
