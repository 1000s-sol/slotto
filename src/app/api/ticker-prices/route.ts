import { NextResponse } from "next/server";

import { fetchHeliusTokenMeta, normalizeImageUrl } from "@/lib/helius-token-meta";
import { isUnreliableTokenImageHost } from "@/lib/project-token-display";
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
  tokenImageUrl: string | null;
  tokenName: string | null;
};

function abbrevMint(mint: string) {
  return `${mint.slice(0, 4)}…${mint.slice(-4)}`;
}

async function buildTickerSlots(): Promise<TickerSlot[]> {
  const projects = await fetchLiquidTickerProjects();
  const slots: TickerSlot[] = [
    {
      mint: WRAPPED_SOL_MINT,
      projectSlug: null,
      projectName: null,
      tokenImageUrl: null,
      tokenName: null,
    },
  ];
  for (const p of projects) {
    slots.push({
      mint: p.mint,
      projectSlug: p.slug,
      projectName: p.name,
      tokenImageUrl: p.tokenImageUrl,
      tokenName: p.tokenName,
    });
  }
  return slots;
}

/** Dex/Helius first (what used to work); swap only when missing or known-dead host. */
function pickTickerLogo(
  dexLogo: string | null,
  heliusLogo: string | null,
  storedLogo: string | null,
): string | null {
  const market = dexLogo || heliusLogo || null;
  if (market && !isUnreliableTokenImageHost(market)) return market;
  if (storedLogo) return storedLogo;
  return market;
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
      const dexLogo = normalizeImageUrl(row?.info?.imageUrl);
      // Fetch Helius when Dex has no image, or only a known-dead host (GenesysGo).
      return (
        mint !== WRAPPED_SOL_MINT &&
        (!dexLogo || isUnreliableTokenImageHost(dexLogo))
      );
    });

    const heliusMap = new Map<string, Awaited<ReturnType<typeof fetchHeliusTokenMeta>>>();
    await Promise.all(
      needsHelius.map(async (mint) => {
        heliusMap.set(mint, await fetchHeliusTokenMeta(mint));
      }),
    );

    // SOL logo when Dex omits it.
    if (!byMint.get(WRAPPED_SOL_MINT)?.info?.imageUrl?.trim()) {
      heliusMap.set(WRAPPED_SOL_MINT, await fetchHeliusTokenMeta(WRAPPED_SOL_MINT));
    }

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
            slot.tokenName?.trim() ||
            abbrevMint(mint);

      if (mint !== WRAPPED_SOL_MINT && symbol.length > 12) {
        symbol = symbol.slice(0, 12);
      }

      const dexLogo = normalizeImageUrl(row?.info?.imageUrl);
      const heliusLogo = normalizeImageUrl(helius?.image);
      const storedLogo = normalizeImageUrl(slot.tokenImageUrl ?? undefined);
      const logoUrl =
        mint === WRAPPED_SOL_MINT
          ? dexLogo || heliusLogo || null
          : pickTickerLogo(dexLogo, heliusLogo, storedLogo);

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
      {
        mint: WRAPPED_SOL_MINT,
        projectSlug: null,
        projectName: null,
        tokenImageUrl: null,
        tokenName: null,
      },
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
