import { PublicKey } from "@solana/web3.js";

import { lotteryCluster } from "@/lib/lottery/cluster";

/** Switchboard On-Demand queue for verifiable randomness (see docs/switchboard-vrf.md). */
export const SWITCHBOARD_QUEUE_MAINNET = new PublicKey(
  "A43DyUGA7s8eXPxqEjJY6EBu1KKbNgfxF8h17VAHn13w",
);

export const SWITCHBOARD_QUEUE_DEVNET = new PublicKey(
  "EYiAmGSdsQTuCw413V5BzaruWuCCSDgTPtBGvLkXHbe7",
);

export function switchboardQueueForCluster(
  cluster: "devnet" | "mainnet-beta" = lotteryCluster(),
): PublicKey {
  return cluster === "devnet"
    ? SWITCHBOARD_QUEUE_DEVNET
    : SWITCHBOARD_QUEUE_MAINNET;
}
