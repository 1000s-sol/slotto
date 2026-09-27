import { fetchHeliusTokenMeta, normalizeImageUrl } from "@/lib/helius-token-meta";
import { prisma } from "@/lib/prisma";
import { fetchDexTokenRows } from "@/lib/token-usd-prices";

export type CachedTokenDisplay = {
  mint: string;
  symbol: string | null;
  imageUrl: string | null;
  source: string | null;
};

/** Sources that are real token metadata (not project listing art). */
const MARKET_SOURCES = new Set(["dex", "helius", "jupiter", "token"]);

function abbrevMint(mint: string): string {
  return `${mint.slice(0, 4)}…${mint.slice(-4)}`;
}

function isMarketTokenImage(
  imageUrl: string | null,
  source: string | null,
): boolean {
  if (!imageUrl) return false;
  if (source && MARKET_SOURCES.has(source)) return true;
  // Previously cached project listing blobs — treat as non-token art.
  if (
    imageUrl.includes("blob.vercel-storage.com") &&
    imageUrl.includes("/projects/")
  ) {
    return false;
  }
  if (source === "project" || source === "listing") return false;
  return true;
}

let tableReady: Promise<void> | null = null;

/** Idempotent — creates the cache table if Neon has not been db-pushed yet. */
function ensureTokenDisplayCacheTable(): Promise<void> {
  if (!tableReady) {
    tableReady = prisma
      .$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "TokenDisplayCache" (
          "mint" TEXT NOT NULL,
          "symbol" TEXT,
          "imageUrl" TEXT,
          "source" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "TokenDisplayCache_pkey" PRIMARY KEY ("mint")
        )
      `)
      .then(() => undefined)
      .catch((e) => {
        tableReady = null;
        console.warn("[token-display-cache] ensure table failed:", e);
      });
  }
  return tableReady ?? Promise.resolve();
}

async function writeCache(
  mint: string,
  symbol: string | null,
  imageUrl: string | null,
  source: string | null,
): Promise<void> {
  try {
    await ensureTokenDisplayCacheTable();
    await prisma.tokenDisplayCache.upsert({
      where: { mint },
      create: { mint, symbol, imageUrl, source },
      update: {
        ...(symbol ? { symbol } : {}),
        ...(imageUrl ? { imageUrl, source } : {}),
        updatedAt: new Date(),
      },
    });
  } catch (e) {
    console.warn("[token-display-cache] write failed:", e);
  }
}

async function fetchJupiterTokenMeta(
  mint: string,
): Promise<{ symbol?: string; icon?: string } | null> {
  try {
    const res = await fetch(
      `https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(mint)}`,
      { headers: { Accept: "application/json" }, next: { revalidate: 3600 } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{
      id?: string;
      symbol?: string;
      icon?: string;
    }>;
    const row = Array.isArray(data)
      ? data.find((r) => r.id === mint) ?? data[0]
      : undefined;
    if (!row) return null;
    return { symbol: row.symbol?.trim(), icon: row.icon?.trim() };
  } catch {
    return null;
  }
}

export type ProjectDisplayHints = {
  tokenName?: string | null;
  /** Custom logo for non-liquid tokens only — not project listing art. */
  tokenImageUrl?: string | null;
  liquid?: boolean;
};

type ResolvedDisplay = { symbol: string; imageUrl: string | null };

/**
 * Resolve market token logo + symbol.
 * Prefer Dex → Helius → Jupiter. Non-liquid projects may use tokenImageUrl last.
 * Never uses project listing/banner images.
 */
async function resolveOneTokenDisplay(
  mint: string,
  hints: ProjectDisplayHints | undefined,
  cached: CachedTokenDisplay | null,
  dexImg: string | null,
  dexSymbol: string | null,
): Promise<ResolvedDisplay> {
  const nonLiquid = hints?.liquid === false;
  const customTokenLogo = nonLiquid
    ? normalizeImageUrl(hints?.tokenImageUrl ?? undefined)
    : null;
  const customTokenSymbol = hints?.tokenName?.trim() || null;

  // Trust cache only when it already holds a market token image.
  if (
    cached?.imageUrl &&
    cached.symbol &&
    isMarketTokenImage(cached.imageUrl, cached.source)
  ) {
    return { symbol: cached.symbol, imageUrl: cached.imageUrl };
  }

  // Non-liquid custom token art (e.g. BUX) — intentional tokenImageUrl.
  if (customTokenLogo) {
    const symbol = customTokenSymbol || cached?.symbol || abbrevMint(mint);
    const outSymbol = symbol.length > 12 ? symbol.slice(0, 12) : symbol;
    await writeCache(mint, outSymbol, customTokenLogo, "token");
    return { symbol: outSymbol, imageUrl: customTokenLogo };
  }

  let symbol = dexSymbol || cached?.symbol || customTokenSymbol;
  let imageUrl = dexImg;
  let source: string | null = dexImg ? "dex" : null;

  if (!imageUrl || !symbol) {
    const helius = await fetchHeliusTokenMeta(mint).catch(() => null);
    if (!symbol) symbol = helius?.symbol?.trim() || null;
    if (!imageUrl && helius?.image) {
      imageUrl = normalizeImageUrl(helius.image);
      source = "helius";
    }
  }

  if (!imageUrl || !symbol) {
    const jup = await fetchJupiterTokenMeta(mint);
    if (!symbol) symbol = jup?.symbol || null;
    if (!imageUrl && jup?.icon) {
      imageUrl = normalizeImageUrl(jup.icon);
      source = "jupiter";
    }
  }

  // Last resort for liquid tokens: stored tokenImageUrl only (never listing art).
  if (!imageUrl) {
    const fallback = normalizeImageUrl(hints?.tokenImageUrl ?? undefined);
    if (fallback) {
      imageUrl = fallback;
      source = "token";
    }
  }

  let outSymbol = symbol || abbrevMint(mint);
  if (outSymbol.length > 12) outSymbol = outSymbol.slice(0, 12);

  if (imageUrl || outSymbol !== abbrevMint(mint)) {
    await writeCache(mint, outSymbol, imageUrl, source);
  }

  return { symbol: outSymbol, imageUrl };
}

/** Batch resolve for buyback table — market token logos, cache-backed. */
export async function resolveTokenDisplays(
  mints: string[],
  hintsByMint?: Map<string, ProjectDisplayHints>,
): Promise<Map<string, ResolvedDisplay>> {
  const unique = [...new Set(mints.map((m) => m.trim()).filter(Boolean))];
  const out = new Map<string, ResolvedDisplay>();
  if (unique.length === 0) return out;

  let cachedRows: Awaited<
    ReturnType<typeof prisma.tokenDisplayCache.findMany>
  > = [];
  try {
    await ensureTokenDisplayCacheTable();
    cachedRows = await prisma.tokenDisplayCache.findMany({
      where: { mint: { in: unique } },
    });
  } catch {
    cachedRows = [];
  }
  const cacheByMint = new Map(
    cachedRows.map((r) => [
      r.mint,
      {
        mint: r.mint,
        symbol: r.symbol,
        imageUrl: normalizeImageUrl(r.imageUrl ?? undefined),
        source: r.source,
      } satisfies CachedTokenDisplay,
    ]),
  );

  // Always pull Dex for this batch — cheap + authoritative token icons.
  const dexMap = await fetchDexTokenRows(unique);

  await Promise.all(
    unique.map(async (mint) => {
      const hints = hintsByMint?.get(mint);
      const cached = cacheByMint.get(mint) ?? null;
      const dex = dexMap.get(mint);
      const resolved = await resolveOneTokenDisplay(
        mint,
        hints,
        cached,
        normalizeImageUrl(dex?.info?.imageUrl),
        dex?.baseToken?.symbol?.trim() || null,
      );
      out.set(mint, resolved);
    }),
  );

  return out;
}
