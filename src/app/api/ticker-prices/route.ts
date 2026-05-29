import { NextResponse } from "next/server";

import { fetchHeliusTokenMeta, normalizeImageUrl } from "@/lib/helius-token-meta";
import { fetchLiquidTickerProjects } from "@/lib/ticker-liquid-projects";
import {
  fetchDexTokenRows,
  fetchJupiterUsd,
  resolveTokenUsdPrice,
  WRAPPED_SOL_MINT,
} from "@/lib/token-usd-prices";

type TickerItem = {
  mint: string;
  symbol: string;
  priceUsd: number | null;
  logoUrl: string | null;
  projectSlug: string | null;
  projectName: string | null;
};

type TickerSlot = {
  mint: string;
  projectSlug: string | null;
  projectName: string | null;
};

function abbrevMint(mint: string) {
  return `${mint.slice(0, 4)}…${mint.slice(-4)}`;
}

async function buildTickerSlots(): Promise<TickerSlot[]> {
  const projects = await fetchLiquidTickerProjects();
  const slots: TickerSlot[] = [
    { mint: WRAPPED_SOL_MINT, projectSlug: null, projectName: null },
  ];
  for (const p of projects) {
    slots.push({ mint: p.mint, projectSlug: p.slug, projectName: p.name });
  }
  return slots;
}

export async function GET() {
  try {
    const slots = await buildTickerSlots();
    const mints = [...new Set(slots.map((s) => s.mint))];

    const [byMint, jupUsd] = await Promise.all([
      fetchDexTokenRows(mints),
      fetchJupiterUsd(mints),
    ]);

    const needsHelius = mints.filter((mint) => {
      const row = byMint.get(mint);
      return mint !== WRAPPED_SOL_MINT && !row?.info?.imageUrl?.trim();
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
      const priceUsd = resolveTokenUsdPrice(mint, row, jupUsd[mint] ?? null);

      let symbol =
        mint === WRAPPED_SOL_MINT
          ? "SOL"
          : row?.baseToken?.symbol?.trim() ||
            helius?.symbol?.trim() ||
            abbrevMint(mint);

      if (mint !== WRAPPED_SOL_MINT && symbol.length > 12) {
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
      { mint: WRAPPED_SOL_MINT, projectSlug: null, projectName: null },
    ]);
    return NextResponse.json({
      items: slots.map((slot) => ({
        mint: slot.mint,
        symbol: slot.mint === WRAPPED_SOL_MINT ? "SOL" : abbrevMint(slot.mint),
        priceUsd: null,
        logoUrl: null,
        projectSlug: slot.projectSlug,
        projectName: slot.projectName,
      })),
    });
  }
}
