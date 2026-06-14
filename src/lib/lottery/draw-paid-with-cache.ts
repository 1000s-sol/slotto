type CacheRow = {
  paidWith: Record<string, string[]>;
  complete: boolean;
  exp: number;
};

const TTL_MS = 300_000;
const cache = new Map<number, CacheRow>();

export function getDrawPaidWithCached(
  drawId: number,
): { paidWith: Record<string, string[]>; complete: boolean } | null {
  const row = cache.get(drawId);
  if (!row || row.exp < Date.now()) {
    cache.delete(drawId);
    return null;
  }
  if (Object.keys(row.paidWith).length === 0) {
    cache.delete(drawId);
    return null;
  }
  if (!row.complete) {
    cache.delete(drawId);
    return null;
  }
  return { paidWith: row.paidWith, complete: row.complete };
}

export function setDrawPaidWithCached(
  drawId: number,
  paidWith: Record<string, string[]>,
  complete: boolean,
): void {
  if (!complete || Object.keys(paidWith).length === 0) return;
  cache.set(drawId, { paidWith, complete, exp: Date.now() + TTL_MS });
}
