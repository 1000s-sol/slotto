import { Connection } from "@solana/web3.js";

import {
  heliusRpcUrl,
  parseHeliusApiKeys,
} from "@/lib/helius-api-keys";
import { resolveLotteryClusterEnv } from "@/lib/lottery/cluster";

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

function heliusUrlsForCluster(): string[] {
  const cluster = resolveLotteryClusterEnv();
  return parseHeliusApiKeys().map((key) => heliusRpcUrl(cluster, key));
}

/** Server actions / API: rotate Helius keys on 429/401, then public cluster. */
export async function withLotteryServerRpc<T>(
  fn: (connection: Connection) => Promise<T>,
): Promise<T> {
  const heliusUrls = heliusUrlsForCluster();
  const primaryUrl = resolveLotteryRpcUrl();
  const fallbackUrl = lotteryPublicRpcFallback();

  const tryUrls = [
    ...new Set([
      primaryUrl,
      ...heliusUrls.filter((u) => u !== primaryUrl),
    ]),
  ];

  async function run(url: string): Promise<T> {
    return fn(makeConnection(url));
  }

  let lastError: unknown;

  for (const url of tryUrls) {
    try {
      return await run(url);
    } catch (e) {
      lastError = e;
      const message = lotteryRpcErrorText(e);
      if (!isRpcFallbackError(message)) throw e;
      console.warn(`[lottery rpc] ${url.slice(0, 48)}… failed — trying next endpoint`);
    }
  }

  if (isRpcRateLimitError(lotteryRpcErrorText(lastError))) {
    await sleep(1500);
    for (const url of tryUrls) {
      try {
        return await run(url);
      } catch (e) {
        lastError = e;
        const message = lotteryRpcErrorText(e);
        if (!isRpcFallbackError(message)) throw e;
      }
    }
  }

  if (fallbackUrl && !tryUrls.includes(fallbackUrl)) {
    console.warn("[lottery rpc] Helius exhausted — using public cluster fallback");
    return run(fallbackUrl);
  }

  throw lastError;
}
