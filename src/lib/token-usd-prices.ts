/** Wrapped SOL — DexScreener / Jupiter “SOL” spot price */
export const WRAPPED_SOL_MINT =
  "So11111111111111111111111111111111111111112";

export type DexTokenRow = {
  baseToken: { address: string; symbol?: string; name?: string };
  priceUsd?: string;
  info?: { imageUrl?: string };
};

export type TickerPriceItem = {
  mint: string;
  priceUsd: number | null;
};

/** USD spot for one mint: DexScreener first, Jupiter fallback (same as ticker banner). */
export function resolveTokenUsdPrice(
  mint: string,
  dexRow: DexTokenRow | undefined,
  jupUsd: number | null | undefined,
): number | null {
  const rawDex = dexRow?.priceUsd;
  const dexPrice =
    rawDex !== undefined && rawDex !== null && rawDex !== ""
      ? Number(rawDex)
      : NaN;
  if (Number.isFinite(dexPrice)) return dexPrice;
  if (jupUsd != null && Number.isFinite(jupUsd)) return jupUsd;
  return null;
}

export async function fetchJupiterUsd(
  mints: string[],
): Promise<Record<string, number | null>> {
  const out: Record<string, number | null> = {};
  for (const m of mints) out[m] = null;
  if (!mints.length) return out;
  try {
    const url = `https://api.jup.ag/price/v3/price?ids=${mints.join(",")}`;
    const res = await fetch(url, { next: { revalidate: 30 } });
    if (!res.ok) return out;
    const json = (await res.json()) as Record<
      string,
      { usdPrice?: number } | undefined
    >;
    for (const m of mints) {
      const p = json[m]?.usdPrice;
      out[m] = typeof p === "number" && Number.isFinite(p) ? p : null;
    }
  } catch {
    /* keep nulls */
  }
  return out;
}

/** DexScreener rows for logos/symbols (ticker banner). */
export async function fetchDexTokenRows(
  mints: string[],
): Promise<Map<string, DexTokenRow>> {
  const byMint = new Map<string, DexTokenRow>();
  const unique = [...new Set(mints)];
  const chunkSize = 20;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    try {
      const res = await fetch(
        `https://api.dexscreener.com/tokens/v1/solana/${chunk.join(",")}`,
        { headers: { Accept: "application/json" }, next: { revalidate: 30 } },
      );
      if (!res.ok) continue;
      const data = (await res.json()) as DexTokenRow[];
      for (const row of data) {
        const addr = row.baseToken?.address;
        if (addr && !byMint.has(addr)) byMint.set(addr, row);
      }
    } catch {
      /* partial data ok */
    }
  }
  return byMint;
}

/** Server-side USD prices for mints (Dex + Jupiter, ticker banner logic). */
export async function fetchTokenUsdPrices(
  mints: string[],
): Promise<Map<string, number | null>> {
  const unique = [...new Set(mints)];
  const out = new Map<string, number | null>();
  if (!unique.length) return out;

  const [byMint, jupUsd] = await Promise.all([
    fetchDexTokenRows(unique),
    fetchJupiterUsd(unique),
  ]);

  for (const mint of unique) {
    out.set(
      mint,
      resolveTokenUsdPrice(mint, byMint.get(mint), jupUsd[mint] ?? null),
    );
  }
  return out;
}

export function usdPriceFromTickerItems(
  items: TickerPriceItem[],
  mint: string,
): number | null {
  const row = items.find((i) => i.mint === mint);
  const p = row?.priceUsd;
  return p != null && Number.isFinite(p) ? p : null;
}
