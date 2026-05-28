/** Solana cluster inferred from lottery RPC URL (app + scripts). */
export type LotteryCluster = "devnet" | "mainnet-beta";

export function lotteryClusterFromRpc(rpc: string): LotteryCluster {
  const lower = rpc.toLowerCase();
  if (lower.includes("devnet")) return "devnet";
  return "mainnet-beta";
}

/** Cluster for Solscan links and UI copy. Uses `NEXT_PUBLIC_SOLANA_RPC_URL` when set. */
export function lotteryCluster(): LotteryCluster {
  const rpc = process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.trim() ?? "";
  if (rpc) return lotteryClusterFromRpc(rpc);
  if (process.env.NEXT_PUBLIC_SLOTTO_LOTTERY_PROGRAM_ID?.trim()) {
    return "devnet";
  }
  return "mainnet-beta";
}

export function isMainnetLottery(): boolean {
  return lotteryCluster() === "mainnet-beta";
}
