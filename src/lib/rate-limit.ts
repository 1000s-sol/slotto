/**
 * Lightweight in-memory fixed-window rate limiter for unauthenticated routes.
 *
 * This is best-effort per server instance (Vercel may run several), so it is a
 * dampener against spam / cost-amplification, not a hard guarantee. For strict
 * limits use a shared store (Redis/Upstash). Good enough to blunt the
 * unauthenticated, expensive RPC/Discord endpoints before launch.
 */
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** Periodically drop expired buckets so the map can't grow unbounded. */
function sweep(now: number): void {
  if (buckets.size < 5_000) return;
  for (const [key, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(key);
  }
}

export type RateLimitResult = {
  ok: boolean;
  /** Seconds until the window resets (for Retry-After). */
  retryAfter: number;
};

/**
 * Returns `{ ok: false }` when `key` has exceeded `limit` requests within
 * `windowMs`. Each distinct `key` (e.g. `"social:" + ip`) is tracked separately.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  sweep(now);
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  existing.count += 1;
  if (existing.count > limit) {
    return { ok: false, retryAfter: Math.ceil((existing.resetAt - now) / 1000) };
  }
  return { ok: true, retryAfter: 0 };
}

/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for). */
export function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

/** A base58 string in the 32–44 char range typical of Solana pubkeys/mints. */
const BASE58_PUBKEY = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function isLikelyBase58Pubkey(value: string): boolean {
  return BASE58_PUBKEY.test(value);
}
