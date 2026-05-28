import { PublicKey } from "@solana/web3.js";

import { lotteryCluster } from "@/lib/lottery/cluster";

/** Switchboard On-Demand program IDs (must match `programs/slotto_lottery/src/switchboard_randomness.rs`). */
export const SWITCHBOARD_ON_DEMAND_MAINNET = new PublicKey(
  "SBondMDrcV3K4kxZR1HNVT7osZxAHVHgYXL5Ze1oMUv",
);

export const SWITCHBOARD_ON_DEMAND_DEVNET = new PublicKey(
  "Aio4gaXjXzJNVLtzwtNVmSqGKpANtXhybbkhtAC94ji2",
);

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
