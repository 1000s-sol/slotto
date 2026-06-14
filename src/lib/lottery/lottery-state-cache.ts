import type { LotteryStateSnapshot } from "./fetch-lottery-state";

type CacheRow = {
  state: LotteryStateSnapshot;
  exp: number;
};

const TTL_MS = 20_000;
let cache: CacheRow | null = null;

/** Short-lived snapshot so brief Helius 429s do not 500 the homepage buy UI. */
export async function withLotteryStateCache(
  fetchFresh: () => Promise<LotteryStateSnapshot>,
): Promise<LotteryStateSnapshot> {
  if (cache && cache.exp > Date.now()) {
    return cache.state;
  }

  try {
    const state = await fetchFresh();
    cache = { state, exp: Date.now() + TTL_MS };
    return state;
  } catch (e) {
    if (cache) return cache.state;
    throw e;
  }
}
