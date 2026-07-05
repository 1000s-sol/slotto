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

function rotateUrls(urls: string[]): string[] {
  if (urls.length <= 1) return urls;
  const start = Math.floor(Math.random() * urls.length);
  return [...urls.slice(start), ...urls.slice(0, start)];
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

/**
 * Helius keys only — for signature confirm/send where public RPC returns null
 * status and causes false "Confirmation timed out" under load.
 */
export async function withLotteryHeliusRpc<T>(
  fn: (connection: Connection) => Promise<T>,
): Promise<T> {
  const urls = rotateUrls([...new Set(heliusUrlsForCluster())]);
  if (urls.length === 0) {
    return withLotteryServerRpc(fn);
  }

  let lastError: unknown;
  const passes = 4;

  for (let pass = 0; pass < passes; pass += 1) {
    for (const url of urls) {
      try {
        return await fn(makeConnection(url));
      } catch (e) {
        lastError = e;
        const message = lotteryRpcErrorText(e);
        if (!isRpcFallbackError(message)) throw e;
        console.warn(
          `[lottery rpc helius] ${url.slice(0, 48)}… failed (pass ${pass + 1}/${passes})`,
        );
      }
    }
    if (pass < passes - 1) {
      await sleep(1200 * (pass + 1));
    }
  }

  throw lastError ?? new Error("All Helius RPC endpoints failed");
}
