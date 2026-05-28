import { lotteryClusterFromRpc, type LotteryCluster } from "@/lib/lottery/cluster";

const DEFAULT_RPC: Record<LotteryCluster, string> = {
  devnet: "https://api.devnet.solana.com",
  "mainnet-beta": "https://api.mainnet-beta.solana.com",
};

/** RPC for lottery crank / scripts. Prefer explicit env on production (Helius mainnet). */
export function resolveLotteryRpcUrl(): string {
  const explicit =
    process.env.LOTTERY_RPC_URL?.trim() ||
    process.env.LOTTERY_DEVNET_RPC?.trim() ||
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.trim();
  if (explicit) return explicit;

  const cluster = process.env.LOTTERY_CLUSTER?.trim();
  if (cluster === "mainnet-beta") return DEFAULT_RPC["mainnet-beta"];

  if (process.env.NODE_ENV === "production") {
    return DEFAULT_RPC["mainnet-beta"];
  }
  return DEFAULT_RPC.devnet;
}

export function resolveLotteryCluster(): LotteryCluster {
  return lotteryClusterFromRpc(resolveLotteryRpcUrl());
}
