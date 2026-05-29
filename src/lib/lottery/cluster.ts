/** Solana cluster for lottery (app + scripts). */
export type LotteryCluster = "devnet" | "mainnet-beta";

export function lotteryClusterFromRpc(rpc: string): LotteryCluster {
  const lower = rpc.toLowerCase();
  if (lower.includes("devnet")) return "devnet";
  return "mainnet-beta";
}

/**
 * Target cluster for lottery (browser + server).
 * Set `NEXT_PUBLIC_LOTTERY_CLUSTER` on Vercel/local so the admin wallet uses mainnet
 * even when `LOTTERY_CLUSTER` is server-only.
 */
export function resolveLotteryClusterEnv(): LotteryCluster {
  const publicCluster = process.env.NEXT_PUBLIC_LOTTERY_CLUSTER?.trim();
  if (publicCluster === "mainnet-beta" || publicCluster === "devnet") {
    return publicCluster;
  }

  const cluster = process.env.LOTTERY_CLUSTER?.trim();
  if (cluster === "mainnet-beta" || cluster === "devnet") return cluster;

  const publicRpc = process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.trim();
  if (publicRpc) return lotteryClusterFromRpc(publicRpc);

  if (process.env.NODE_ENV === "production") return "mainnet-beta";
  return "devnet";
}

/** Cluster for Solscan links and UI copy. */
export function lotteryCluster(): LotteryCluster {
  return resolveLotteryClusterEnv();
}

export function lotteryClusterLabel(cluster: LotteryCluster = lotteryCluster()): string {
  return cluster === "devnet" ? "devnet" : "mainnet";
}

export function isMainnetLottery(): boolean {
  return lotteryCluster() === "mainnet-beta";
}

/** True when a configured public RPC URL targets a different cluster than env. */
export function publicRpcClusterMismatch(): boolean {
  const rpc = process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.trim();
  if (!rpc) return false;
  return lotteryClusterFromRpc(rpc) !== resolveLotteryClusterEnv();
}
