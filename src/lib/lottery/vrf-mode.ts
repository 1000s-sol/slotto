import { isMainnetLottery, lotteryCluster } from "@/lib/lottery/cluster";

export type LotteryVrfMode = "stub" | "switchboard";

/** How the keeper settles draws. Mainnet defaults to Switchboard when unset. */
export function lotteryVrfMode(): LotteryVrfMode {
  const raw = process.env.LOTTERY_VRF_MODE?.trim().toLowerCase();
  if (raw === "stub" || raw === "switchboard") return raw;
  return isMainnetLottery() ? "switchboard" : "stub";
}

export function lotteryVrfModeLabel(): string {
  const mode = lotteryVrfMode();
  const cluster = lotteryCluster();
  return `${mode} (${cluster})`;
}
