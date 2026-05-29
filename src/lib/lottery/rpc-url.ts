import { lotteryClusterFromRpc, type LotteryCluster } from "@/lib/lottery/cluster";

const DEVNET_PROGRAM_ID = "6mYYxtJ4NPH1oNJoy2CpJGQq6XiWCsu8iB5y6ior6TMq";

export const LOTTERY_PUBLIC_DEVNET_RPC = "https://api.devnet.solana.com";
export const LOTTERY_PUBLIC_MAINNET_RPC = "https://api.mainnet-beta.solana.com";

const DEFAULT_RPC: Record<LotteryCluster, string> = {
  devnet: LOTTERY_PUBLIC_DEVNET_RPC,
  "mainnet-beta": LOTTERY_PUBLIC_MAINNET_RPC,
};

/** Cluster for server crank — Vercel must set LOTTERY_CLUSTER or devnet program id. */
export function resolveLotteryClusterEnv(): LotteryCluster {
  const cluster = process.env.LOTTERY_CLUSTER?.trim();
  if (cluster === "mainnet-beta" || cluster === "devnet") return cluster;

  const programId = process.env.NEXT_PUBLIC_SLOTTO_LOTTERY_PROGRAM_ID?.trim();
  if (programId === DEVNET_PROGRAM_ID) return "devnet";

  const publicRpc = process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.trim();
  if (publicRpc) return lotteryClusterFromRpc(publicRpc);

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

/** Browser / wallet adapter only (`NEXT_PUBLIC_*`). Not used for settlement crank. */
export function resolvePublicSolanaRpcUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.trim();
  if (fromEnv) return fromEnv;
  return DEFAULT_RPC[resolveLotteryClusterEnv()];
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
