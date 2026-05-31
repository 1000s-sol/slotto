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

function heliusRpcUrl(cluster: LotteryCluster, apiKey: string): string {
  const host =
    cluster === "mainnet-beta"
      ? "mainnet.helius-rpc.com"
      : "devnet.helius-rpc.com";
  return `https://${host}/?api-key=${apiKey}`;
}

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
 * Public Solana RPC (api.mainnet-beta.solana.com) returns 403 for browser/XHR/ws
 * traffic, so prefer ANY configured provider URL (e.g. Helius with a key) over it.
 * Only falls back to the public endpoint when nothing else is configured.
 */
export function resolvePublicSolanaRpcUrl(): string {
  const cluster = resolveLotteryClusterEnv();
  const candidates = [
    process.env.NEXT_PUBLIC_SOLANA_BROWSER_RPC_URL,
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL,
  ];
  // First pass: a real provider (non-public) on the right cluster.
  for (const c of candidates) {
    const url = c?.trim();
    if (url && lotteryClusterFromRpc(url) === cluster && !isPublicSolanaEndpoint(url)) {
      return url;
    }
  }
  // Second pass: any configured URL on the right cluster.
  for (const c of candidates) {
    const url = c?.trim();
    if (url && lotteryClusterFromRpc(url) === cluster) return url;
  }
  return DEFAULT_RPC[cluster];
}

/** Keyed / Helius URLs in LOTTERY_RPC_URL often 403 on Vercel — use HELIUS_API_KEY instead. */
function isForbiddenLotteryRpc(url: string): boolean {
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
    !isForbiddenLotteryRpc(explicit) &&
    lotteryClusterFromRpc(explicit) === cluster
  ) {
    return explicit;
  }

  const heliusKey = process.env.HELIUS_API_KEY?.trim();
  if (heliusKey) {
    return heliusRpcUrl(cluster, heliusKey);
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
