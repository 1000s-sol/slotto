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

/** True when a URL is safe to embed in client JS (no extractable API keys). */
function isBrowserSafeRpcUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.searchParams.has("api-key") || u.searchParams.has("api_key")) {
      return false;
    }
    const host = u.hostname.toLowerCase();
    // Helius (and similar) require api-key=; bare host always returns 403 in the browser.
    if (host.includes("helius-rpc.com")) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
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

function pickBrowserRpc(candidate: string | undefined, cluster: LotteryCluster): string | null {
  const url = candidate?.trim();
  if (!url) return null;
  if (lotteryClusterFromRpc(url) !== cluster) return null;
  if (!isBrowserSafeRpcUrl(url)) return null;
  return url;
}

/**
 * Browser / wallet adapter + admin signing.
 * Always the public cluster RPC — never Helius (Phantom + keyed URLs caused 403).
 */
export function resolvePublicSolanaRpcUrl(): string {
  const cluster = resolveLotteryClusterEnv();
  return DEFAULT_RPC[cluster];
}

/**
 * Server-side lottery (admin actions, crank, API).
 * Default: public cluster RPC. Helius only when LOTTERY_USE_HELIUS=true + HELIUS_API_KEY.
 * Override anytime with LOTTERY_RPC_URL.
 */
export function resolveLotteryRpcUrl(): string {
  const cluster = resolveLotteryClusterEnv();

  const explicit =
    process.env.LOTTERY_RPC_URL?.trim() ||
    (cluster === "devnet" ? process.env.LOTTERY_DEVNET_RPC?.trim() : undefined);
  if (explicit) return explicit;

  const heliusKey = process.env.HELIUS_API_KEY?.trim();
  if (process.env.LOTTERY_USE_HELIUS === "true" && heliusKey) {
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
