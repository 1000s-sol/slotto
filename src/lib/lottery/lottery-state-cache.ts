import type { LotteryStateSnapshot } from "./fetch-lottery-state";

type CacheRow = {
  state: LotteryStateSnapshot;
  exp: number;
};

const TTL_MS = 20_000;
const caches = new Map<string, CacheRow>();

/** Short-lived snapshot so brief Helius 429s do not 500 the homepage buy UI. */
export async function withLotteryStateCache(
  cacheKey: string,
  fetchFresh: () => Promise<LotteryStateSnapshot>,
): Promise<LotteryStateSnapshot> {
  const cached = caches.get(cacheKey);
  if (cached && cached.exp > Date.now()) {
    return cached.state;
  }

  try {
    const state = await fetchFresh();
    caches.set(cacheKey, { state, exp: Date.now() + TTL_MS });
    return state;
  } catch (e) {
    if (cached) return cached.state;
    throw e;
  }
}
