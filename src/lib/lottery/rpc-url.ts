import { lotteryClusterFromRpc, type LotteryCluster } from "@/lib/lottery/cluster";

const DEFAULT_RPC: Record<LotteryCluster, string> = {
  devnet: "https://api.devnet.solana.com",
  "mainnet-beta": "https://api.mainnet-beta.solana.com",
};

function resolveLotteryClusterEnv(): LotteryCluster {
  const cluster = process.env.LOTTERY_CLUSTER?.trim();
  if (cluster === "mainnet-beta" || cluster === "devnet") return cluster;
  const publicRpc = process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.trim();
  if (publicRpc) return lotteryClusterFromRpc(publicRpc);
  if (process.env.NEXT_PUBLIC_SLOTTO_LOTTERY_PROGRAM_ID?.trim()) {
    return "devnet";
  }
  if (process.env.NODE_ENV === "production") return "mainnet-beta";
  return "devnet";
}

function heliusRpcUrl(cluster: LotteryCluster, apiKey: string): string {
  const host =
    cluster === "mainnet-beta"
      ? "mainnet.helius-rpc.com"
      : "devnet.helius-rpc.com";
  return `https://${host}/?api-key=${apiKey}`;
}

/** Browser / wallet adapter RPC (public env only). */
export function resolvePublicSolanaRpcUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.trim();
  if (fromEnv) return fromEnv;
  const cluster = resolveLotteryClusterEnv();
  return DEFAULT_RPC[cluster];
}

/**
 * Server-side lottery crank / scripts.
 * Prefer `LOTTERY_RPC_URL` or `HELIUS_API_KEY` so settlement does not depend on a
 * possibly stale `NEXT_PUBLIC_SOLANA_RPC_URL` Helius URL on Vercel.
 */
export function resolveLotteryRpcUrl(): string {
  const explicit =
    process.env.LOTTERY_RPC_URL?.trim() ||
    process.env.LOTTERY_DEVNET_RPC?.trim();
  if (explicit) return explicit;

  const heliusKey = process.env.HELIUS_API_KEY?.trim();
  if (heliusKey) {
    return heliusRpcUrl(resolveLotteryClusterEnv(), heliusKey);
  }

  const publicUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.trim();
  if (publicUrl) return publicUrl;

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
