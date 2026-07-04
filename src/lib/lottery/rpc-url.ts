import {
  heliusRpcUrl,
  parseHeliusApiKeys,
} from "@/lib/helius-api-keys";
import {
  lotteryClusterFromRpc,
  resolveLotteryClusterEnv,
  type LotteryCluster,
} from "@/lib/lottery/cluster";

export const LOTTERY_PUBLIC_DEVNET_RPC = "https://api.devnet.solana.com";
export const LOTTERY_PUBLIC_MAINNET_RPC = "https://api.mainnet-beta.solana.com";

const DEFAULT_RPC: Record<LotteryCluster, string> = {
  devnet: LOTTERY_PUBLIC_DEVNET_RPC,
  "mainnet-beta": LOTTERY_PUBLIC_MAINNET_RPC,
};

export { resolveLotteryClusterEnv };

export { heliusRpcUrl, parseHeliusApiKeys };

/** Helius / RPC auth failures — retry public cluster endpoint when configured. */
export function isRpcAuthError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("401") ||
    lower.includes("403") ||
    lower.includes("access forbidden") ||
    lower.includes("invalid api key") ||
    lower.includes("-32401") ||
    lower.includes("unauthorized")
  );
}

/** RPC rate limits (Helius -32429, HTTP 429) — backoff then try public fallback. */
export function isRpcRateLimitError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("429") ||
    lower.includes("too many requests") ||
    lower.includes("rate limit") ||
    lower.includes("rate limited") ||
    lower.includes("-32429")
  );
}

/** Errors where switching to the public cluster RPC may succeed. */
export function isRpcFallbackError(message: string): boolean {
  return isRpcAuthError(message) || isRpcRateLimitError(message);
}

/** Public Solana endpoints 403 browser traffic — only usable as a last resort. */
function isPublicSolanaEndpoint(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    lower.includes("api.mainnet-beta.solana.com") ||
    lower.includes("api.devnet.solana.com")
  );
}

/**
 * Browser / wallet adapter RPC.
 * Never use Helius api-key URLs here — keys belong in HELIUS_API_KEYS (server only).
 * Ticket buys use server blockhash/broadcast; this Connection is for Anchor `.transaction()` only.
 */
export function resolvePublicSolanaRpcUrl(): string {
  const cluster = resolveLotteryClusterEnv();
  const candidates = [
    process.env.NEXT_PUBLIC_SOLANA_BROWSER_RPC_URL,
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL,
  ];
  for (const c of candidates) {
    const url = c?.trim();
    if (
      url &&
      lotteryClusterFromRpc(url) === cluster &&
      !isPublicSolanaEndpoint(url) &&
      !isServerOnlyRpcUrl(url)
    ) {
      return url;
    }
  }
  for (const c of candidates) {
    const url = c?.trim();
    if (
      url &&
      lotteryClusterFromRpc(url) === cluster &&
      !isServerOnlyRpcUrl(url)
    ) {
      return url;
    }
  }
  return DEFAULT_RPC[cluster];
}

/** Helius / api-key URLs belong in server env only — never in NEXT_PUBLIC_* (401/403 in browser). */
export function isServerOnlyRpcUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    lower.includes("helius-rpc.com") ||
    lower.includes("api-key=") ||
    lower.includes("api_key=")
  );
}

/**
 * Server-side lottery (admin actions, crank, API).
 * Safe LOTTERY_RPC_URL override > Helius (HELIUS_API_KEY) > public cluster endpoint.
 * Ignores LOTTERY_RPC_URL when it embeds an api-key or points at Helius (common misconfig).
 */
export function resolveLotteryRpcUrl(): string {
  const cluster = resolveLotteryClusterEnv();

  const explicit =
    process.env.LOTTERY_RPC_URL?.trim() ||
    (cluster === "devnet" ? process.env.LOTTERY_DEVNET_RPC?.trim() : undefined);
  if (
    explicit &&
    !isServerOnlyRpcUrl(explicit) &&
    lotteryClusterFromRpc(explicit) === cluster
  ) {
    return explicit;
  }

  const heliusKeys = parseHeliusApiKeys();
  if (heliusKeys.length > 0) {
    return heliusRpcUrl(cluster, heliusKeys[0]!);
  }

  return DEFAULT_RPC[cluster];
}

/** Public cluster RPC when Helius auth fails (devnet or mainnet). */
export function lotteryPublicRpcFallback(): string {
  return resolveLotteryClusterEnv() === "devnet"
    ? LOTTERY_PUBLIC_DEVNET_RPC
    : LOTTERY_PUBLIC_MAINNET_RPC;
}

export function resolveLotteryCluster(): LotteryCluster {
  return lotteryClusterFromRpc(resolveLotteryRpcUrl());
}
