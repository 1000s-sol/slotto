import type {
  LotteryStateFetchOptions,
  LotteryStateSnapshot,
} from "./fetch-lottery-state";

export async function fetchLotteryStateClient(
  options?: LotteryStateFetchOptions,
): Promise<LotteryStateSnapshot> {
  const qs = options?.preview ? "?preview=1" : "";
  const res = await fetch(`/api/lottery/state${qs}`, { cache: "no-store" });
  const json = (await res.json()) as LotteryStateSnapshot & { error?: string };
  if (!res.ok) {
    throw new Error(json.error ?? "Failed to load lottery state");
  }
  return json;
}
