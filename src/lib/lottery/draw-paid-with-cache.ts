type CacheRow = {
  paidWith: Record<string, string[]>;
  exp: number;
};

const TTL_MS = 120_000;
const cache = new Map<number, CacheRow>();

export function getDrawPaidWithCached(
  drawId: number,
): Record<string, string[]> | null {
  const row = cache.get(drawId);
  if (!row || row.exp < Date.now()) {
    cache.delete(drawId);
    return null;
  }
  return row.paidWith;
}

export function setDrawPaidWithCached(
  drawId: number,
  paidWith: Record<string, string[]>,
): void {
  cache.set(drawId, { paidWith, exp: Date.now() + TTL_MS });
}
