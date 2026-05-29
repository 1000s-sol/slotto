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

/**
 * Browser / wallet adapter RPC.
 * Uses `NEXT_PUBLIC_SOLANA_RPC_URL` only when it matches `NEXT_PUBLIC_LOTTERY_CLUSTER`
 * (or inferred cluster); otherwise falls back to the public cluster RPC.
 */
export function resolvePublicSolanaRpcUrl(): string {
  const cluster = resolveLotteryClusterEnv();
  const fromEnv = process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.trim();
  if (fromEnv && lotteryClusterFromRpc(fromEnv) === cluster) {
    return fromEnv;
  }
  return DEFAULT_RPC[cluster];
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
