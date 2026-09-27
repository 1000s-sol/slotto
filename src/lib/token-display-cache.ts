import { fetchHeliusTokenMeta, normalizeImageUrl } from "@/lib/helius-token-meta";
import { prisma } from "@/lib/prisma";
import { fetchDexTokenRows } from "@/lib/token-usd-prices";

export type CachedTokenDisplay = {
  mint: string;
  symbol: string | null;
  imageUrl: string | null;
  source: string | null;
};

function abbrevMint(mint: string): string {
  return `${mint.slice(0, 4)}…${mint.slice(-4)}`;
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

async function readCache(mint: string): Promise<CachedTokenDisplay | null> {
  try {
    await ensureTokenDisplayCacheTable();
    const row = await prisma.tokenDisplayCache.findUnique({ where: { mint } });
    if (!row) return null;
    return {
      mint: row.mint,
      symbol: row.symbol,
      imageUrl: normalizeImageUrl(row.imageUrl ?? undefined),
      source: row.source,
    };
  } catch {
    // Table may not exist until db push — degrade gracefully.
    return null;
  }
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
  tokenImageUrl?: string | null;
  listingImageUrl?: string | null;
  liquid?: boolean;
};

/**
 * Resolve symbol + logo for a mint with persistent Neon cache.
 * Order: cache → project fields → Dex → Helius → Jupiter search.
 */
export async function resolveTokenDisplay(
  mint: string,
  hints?: ProjectDisplayHints,
): Promise<{ symbol: string; imageUrl: string | null }> {
  const m = mint.trim();
  const cached = await readCache(m);

  const projectLogo =
    normalizeImageUrl(hints?.tokenImageUrl ?? undefined) ||
    normalizeImageUrl(hints?.listingImageUrl ?? undefined);
  const projectSymbol = hints?.tokenName?.trim() || null;

  if (cached?.imageUrl && cached.symbol) {
    return { symbol: cached.symbol, imageUrl: cached.imageUrl };
  }

  // Partial cache hit — keep what we have, fill gaps from live sources.
  let symbol = cached?.symbol || projectSymbol;
  let imageUrl = cached?.imageUrl || projectLogo;
  let source = cached?.source || (projectLogo ? "project" : null);

  if (!imageUrl || !symbol) {
    const dexMap = await fetchDexTokenRows([m]);
    const dex = dexMap.get(m);
    if (!symbol) symbol = dex?.baseToken?.symbol?.trim() || null;
    if (!imageUrl) {
      const dexImg = normalizeImageUrl(dex?.info?.imageUrl);
      if (dexImg) {
        imageUrl = dexImg;
        source = "dex";
      }
    }
  }

  if (!imageUrl || !symbol) {
    const helius = await fetchHeliusTokenMeta(m).catch(() => null);
    if (!symbol) symbol = helius?.symbol?.trim() || null;
    if (!imageUrl && helius?.image) {
      imageUrl = normalizeImageUrl(helius.image);
      source = "helius";
    }
  }

  if (!imageUrl || !symbol) {
    const jup = await fetchJupiterTokenMeta(m);
    if (!symbol) symbol = jup?.symbol || null;
    if (!imageUrl && jup?.icon) {
      imageUrl = normalizeImageUrl(jup.icon);
      source = "jupiter";
    }
  }

  let outSymbol = symbol || abbrevMint(m);
  if (outSymbol.length > 12) outSymbol = outSymbol.slice(0, 12);

  // Persist whenever we learned something new.
  if (
    (imageUrl && imageUrl !== cached?.imageUrl) ||
    (outSymbol && outSymbol !== cached?.symbol)
  ) {
    await writeCache(m, outSymbol, imageUrl, source);
  }

  return { symbol: outSymbol, imageUrl };
}

/** Batch resolve for buyback table (cache-first, then fill missing). */
export async function resolveTokenDisplays(
  mints: string[],
  hintsByMint?: Map<string, ProjectDisplayHints>,
): Promise<Map<string, { symbol: string; imageUrl: string | null }>> {
  const unique = [...new Set(mints.map((m) => m.trim()).filter(Boolean))];
  const out = new Map<string, { symbol: string; imageUrl: string | null }>();

  // Load all cache rows in one query.
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
  const cacheByMint = new Map(cachedRows.map((r) => [r.mint, r]));

  const needsLive: string[] = [];
  for (const mint of unique) {
    const cached = cacheByMint.get(mint);
    const hints = hintsByMint?.get(mint);
    const cachedImg = normalizeImageUrl(cached?.imageUrl ?? undefined);
    const cachedSym = cached?.symbol?.trim() || null;
    const hintImg =
      normalizeImageUrl(hints?.tokenImageUrl ?? undefined) ||
      normalizeImageUrl(hints?.listingImageUrl ?? undefined);
    const imageUrl = cachedImg || hintImg;
    const symbol = cachedSym || hints?.tokenName?.trim() || null;
    if (imageUrl && symbol) {
      out.set(mint, {
        symbol: symbol.length > 12 ? symbol.slice(0, 12) : symbol,
        imageUrl,
      });
    } else {
      needsLive.push(mint);
    }
  }

  if (needsLive.length === 0) return out;

  const dexMap = await fetchDexTokenRows(needsLive);
  await Promise.all(
    needsLive.map(async (mint) => {
      const hints = hintsByMint?.get(mint);
      const cached = cacheByMint.get(mint);
      let symbol =
        cached?.symbol?.trim() ||
        hints?.tokenName?.trim() ||
        dexMap.get(mint)?.baseToken?.symbol?.trim() ||
        null;
      let imageUrl =
        normalizeImageUrl(cached?.imageUrl ?? undefined) ||
        normalizeImageUrl(hints?.tokenImageUrl ?? undefined) ||
        normalizeImageUrl(hints?.listingImageUrl ?? undefined) ||
        normalizeImageUrl(dexMap.get(mint)?.info?.imageUrl);
      let source: string | null = imageUrl
        ? cached?.imageUrl
          ? cached.source
          : hints?.tokenImageUrl || hints?.listingImageUrl
            ? "project"
            : "dex"
        : null;

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

      let outSymbol = symbol || abbrevMint(mint);
      if (outSymbol.length > 12) outSymbol = outSymbol.slice(0, 12);

      if (imageUrl || outSymbol !== abbrevMint(mint)) {
        await writeCache(mint, outSymbol, imageUrl, source);
      }

      out.set(mint, { symbol: outSymbol, imageUrl });
    }),
  );

  return out;
}
