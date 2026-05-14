/** Parse a numeric SOL floor from stored `stats` JSON for sorting (primary collection snapshot). */
export function floorSolSortKey(stats: unknown): number {
  if (!stats || typeof stats !== "object") return Number.POSITIVE_INFINITY;
  const o = stats as Record<string, unknown>;
  const candidates = [o.floorSol, o.floor, o.floorPrice, o.priceFloor];
  for (const c of candidates) {
    if (typeof c === "number" && Number.isFinite(c) && c >= 0) return c;
    if (typeof c === "string") {
      const n = Number.parseFloat(c.replace(/[^\d.]/g, ""));
      if (Number.isFinite(n) && n >= 0) return n;
    }
  }
  return Number.POSITIVE_INFINITY;
}
