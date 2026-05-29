import type { LotteryStateSnapshot } from "./fetch-lottery-state";

export async function fetchLotteryStateClient(): Promise<LotteryStateSnapshot> {
  const res = await fetch("/api/lottery/state", { cache: "no-store" });
  const json = (await res.json()) as LotteryStateSnapshot & { error?: string };
  if (!res.ok) {
    throw new Error(json.error ?? "Failed to load lottery state");
  }
  return json;
}
