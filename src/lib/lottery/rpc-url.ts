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

/**
 * Browser / wallet adapter RPC.
 * Prefer an explicitly configured browser RPC (Helius works in-browser with a key);
 * fall back to the public cluster endpoint. Public Solana RPC 403s browser traffic,
 * so set NEXT_PUBLIC_SOLANA_RPC_URL to a real provider for the public site.
 */
export function resolvePublicSolanaRpcUrl(): string {
  const cluster = resolveLotteryClusterEnv();
  const candidates = [
    process.env.NEXT_PUBLIC_SOLANA_BROWSER_RPC_URL,
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL,
  ];
  for (const c of candidates) {
    const url = c?.trim();
    if (url && lotteryClusterFromRpc(url) === cluster) return url;
  }
  return DEFAULT_RPC[cluster];
}

/**
 * Server-side lottery (admin actions, crank, API).
 * LOTTERY_RPC_URL override > Helius (HELIUS_API_KEY) > public cluster endpoint.
 */
export function resolveLotteryRpcUrl(): string {
  const cluster = resolveLotteryClusterEnv();

  const explicit =
    process.env.LOTTERY_RPC_URL?.trim() ||
    (cluster === "devnet" ? process.env.LOTTERY_DEVNET_RPC?.trim() : undefined);
  if (explicit && lotteryClusterFromRpc(explicit) === cluster) {
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
