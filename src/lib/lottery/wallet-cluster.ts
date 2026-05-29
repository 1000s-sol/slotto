import type { Connection } from "@solana/web3.js";

import {
  lotteryClusterFromRpc,
  lotteryClusterLabel,
  resolveLotteryClusterEnv,
  type LotteryCluster,
} from "@/lib/lottery/cluster";

/** Well-known genesis hashes (base58). */
const GENESIS_HASH: Record<LotteryCluster, string> = {
  "mainnet-beta": "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
  devnet: "EtWTRABZaYq6iMfeYKouRu166VU2xqaed",
};

export async function walletMatchesLotteryCluster(
  connection: Connection,
): Promise<boolean> {
  const expected = resolveLotteryClusterEnv();
  const endpoint = connection.rpcEndpoint?.trim();
  if (endpoint) {
    return lotteryClusterFromRpc(endpoint) === expected;
  }
  try {
    const hash = await connection.getGenesisHash();
    return hash === GENESIS_HASH[expected];
  } catch {
    return true;
  }
}

export function lotteryClusterMismatchMessage(): string {
  const label = lotteryClusterLabel(resolveLotteryClusterEnv());
  return `Slotto is on ${label}, but your wallet RPC does not match. In Phantom, open Settings → Developer Settings → Change Network → ${label === "mainnet" ? "Mainnet Beta" : "Devnet"}, then reconnect.`;
}
