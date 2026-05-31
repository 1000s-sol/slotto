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
 * Browser / wallet adapter + admin signing.
 * Always the public cluster RPC — never Helius (Phantom + keyed URLs caused 403).
 */
export function resolvePublicSolanaRpcUrl(): string {
  const cluster = resolveLotteryClusterEnv();
  return DEFAULT_RPC[cluster];
}

/** Helius / keyed RPC caused 403 on Vercel — never use for lottery txs. */
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
 * Always public cluster RPC unless LOTTERY_RPC_URL is a safe non-Helius URL.
 * (Ignores LOTTERY_RPC_URL when it points at Helius — common Vercel misconfig.)
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
