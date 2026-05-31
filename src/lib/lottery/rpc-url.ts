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
    return true;
  } catch {
    return false;
  }
}

function pickBrowserRpc(candidate: string | undefined, cluster: LotteryCluster): string | null {
  const url = candidate?.trim();
  if (!url) return null;
  if (lotteryClusterFromRpc(url) !== cluster) return null;
  if (!isBrowserSafeRpcUrl(url)) return null;
  return url;
}

/**
 * Browser / wallet adapter RPC.
 * Never returns Helius (or other) URLs with `api-key=` — those belong in HELIUS_API_KEY
 * server-side only. Prefer `NEXT_PUBLIC_SOLANA_BROWSER_RPC_URL`, then a safe
 * `NEXT_PUBLIC_SOLANA_RPC_URL`, then the public cluster endpoint.
 */
export function resolvePublicSolanaRpcUrl(): string {
  const cluster = resolveLotteryClusterEnv();
  return (
    pickBrowserRpc(process.env.NEXT_PUBLIC_SOLANA_BROWSER_RPC_URL, cluster) ??
    pickBrowserRpc(process.env.NEXT_PUBLIC_SOLANA_RPC_URL, cluster) ??
    DEFAULT_RPC[cluster]
  );
}

/**
 * Server-side lottery crank (Vercel server action / API).
 * Never uses `NEXT_PUBLIC_SOLANA_RPC_URL` — that URL often has a stale Helius key.
 */
export function resolveLotteryRpcUrl(): string {
  const cluster = resolveLotteryClusterEnv();

  const explicit =
    process.env.LOTTERY_RPC_URL?.trim() ||
    (cluster === "devnet" ? process.env.LOTTERY_DEVNET_RPC?.trim() : undefined);
  if (explicit) return explicit;

  const heliusKey = process.env.HELIUS_API_KEY?.trim();
  if (heliusKey) {
    return heliusRpcUrl(cluster, heliusKey);
  }

  return DEFAULT_RPC[cluster];
}

/** Public devnet RPC fallback when Helius auth fails on Vercel. */
export function lotteryPublicRpcFallback(): string | null {
  return resolveLotteryClusterEnv() === "devnet"
    ? LOTTERY_PUBLIC_DEVNET_RPC
    : null;
}

export function resolveLotteryCluster(): LotteryCluster {
  return lotteryClusterFromRpc(resolveLotteryRpcUrl());
}
