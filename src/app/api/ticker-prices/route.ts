import { NextResponse } from "next/server";

import { fetchHeliusTokenMeta, normalizeImageUrl } from "@/lib/helius-token-meta";
import { fetchLiquidTickerProjects } from "@/lib/ticker-liquid-projects";

/** Wrapped SOL — DexScreener / Jupiter “SOL” spot price */
const SOL_MINT = "So11111111111111111111111111111111111111112";

type TickerItem = {
  mint: string;
  symbol: string;
  priceUsd: number | null;
  logoUrl: string | null;
  projectSlug: string | null;
  projectName: string | null;
};

type DexRow = {
  baseToken: { address: string; symbol?: string; name?: string };
  priceUsd?: string;
  info?: { imageUrl?: string };
};

type TickerSlot = {
  mint: string;
  projectSlug: string | null;
  projectName: string | null;
};

function abbrevMint(mint: string) {
  return `${mint.slice(0, 4)}…${mint.slice(-4)}`;
}

async function fetchJupiterUsd(mints: string[]): Promise<Record<string, number | null>> {
  const out: Record<string, number | null> = {};
  for (const m of mints) out[m] = null;
  if (!mints.length) return out;
  try {
    const url = `https://api.jup.ag/price/v3/price?ids=${mints.join(",")}`;
    const res = await fetch(url, { next: { revalidate: 30 } });
    if (!res.ok) return out;
    const json = (await res.json()) as Record<string, { usdPrice?: number } | undefined>;
    for (const m of mints) {
      const p = json[m]?.usdPrice;
      out[m] = typeof p === "number" && Number.isFinite(p) ? p : null;
    }
  } catch {
    /* keep nulls */
  }
  return out;
}

async function fetchDexByMint(mints: string[]): Promise<Map<string, DexRow>> {
  const byMint = new Map<string, DexRow>();
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
      const data = (await res.json()) as DexRow[];
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

async function buildTickerSlots(): Promise<TickerSlot[]> {
  const projects = await fetchLiquidTickerProjects();
  const slots: TickerSlot[] = [{ mint: SOL_MINT, projectSlug: null, projectName: null }];
  for (const p of projects) {
    slots.push({ mint: p.mint, projectSlug: p.slug, projectName: p.name });
  }
  return slots;
}

export async function GET() {
  try {
    const slots = await buildTickerSlots();
    const mints = [...new Set(slots.map((s) => s.mint))];

    const [byMint, jupUsd] = await Promise.all([fetchDexByMint(mints), fetchJupiterUsd(mints)]);

    const needsHelius = mints.filter((mint) => {
      const row = byMint.get(mint);
      return mint !== SOL_MINT && !row?.info?.imageUrl?.trim();
    });

    const heliusMap = new Map<string, Awaited<ReturnType<typeof fetchHeliusTokenMeta>>>();
    await Promise.all(
      needsHelius.map(async (mint) => {
        heliusMap.set(mint, await fetchHeliusTokenMeta(mint));
      }),
    );

    const items: TickerItem[] = slots.map((slot) => {
      const { mint, projectSlug, projectName } = slot;
      const row = byMint.get(mint);
      const helius = heliusMap.get(mint) ?? null;

      const rawDex = row?.priceUsd;
      const dexPrice =
        rawDex !== undefined && rawDex !== null && rawDex !== ""
          ? Number(rawDex)
          : NaN;
      const jupPrice = jupUsd[mint];
      const priceUsd = Number.isFinite(dexPrice)
        ? dexPrice
        : jupPrice != null && Number.isFinite(jupPrice)
          ? jupPrice
          : null;

      let symbol =
        mint === SOL_MINT
          ? "SOL"
          : row?.baseToken?.symbol?.trim() ||
            helius?.symbol?.trim() ||
            abbrevMint(mint);

      if (mint !== SOL_MINT && symbol.length > 12) {
        symbol = symbol.slice(0, 12);
      }

      const dexLogo = normalizeImageUrl(row?.info?.imageUrl);
      const heliusLogo = normalizeImageUrl(helius?.image);
      const logoUrl = dexLogo || heliusLogo || null;

      return {
        mint,
        symbol,
        priceUsd,
        logoUrl,
        projectSlug,
        projectName,
      };
    });

    return NextResponse.json(
      { items },
      { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } },
    );
  } catch {
    const slots = await buildTickerSlots().catch(() => [
      { mint: SOL_MINT, projectSlug: null, projectName: null },
    ]);
    return NextResponse.json({
      items: slots.map((slot) => ({
        mint: slot.mint,
        symbol: slot.mint === SOL_MINT ? "SOL" : abbrevMint(slot.mint),
        priceUsd: null,
        logoUrl: null,
        projectSlug: slot.projectSlug,
        projectName: slot.projectName,
      })),
    });
  }
}
