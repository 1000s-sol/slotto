import { NextResponse } from "next/server";

import { fetchHeliusTokenMeta, normalizeImageUrl } from "@/lib/helius-token-meta";
import { fetchProjectTokenDisplay } from "@/lib/project-token-display";
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

export async function GET() {
  try {
    const slots = await buildTickerSlots();
    const mints = [...new Set(slots.map((s) => s.mint))];

    const [byMint, jupUsd] = await Promise.all([
      fetchDexTokenRows(mints),
      fetchJupiterUsd(mints),
    ]);

    // Project mints: same logo chain as project pages (skip dead GenesysGo/Firebase,
    // fall back to stored /project-images/* art). SOL keeps Dex/Helius only.
    const projectDisplayByMint = new Map<
      string,
      Awaited<ReturnType<typeof fetchProjectTokenDisplay>>
    >();
    await Promise.all(
      slots
        .filter((s) => s.mint !== WRAPPED_SOL_MINT)
        .map(async (slot) => {
          if (projectDisplayByMint.has(slot.mint)) return;
          projectDisplayByMint.set(
            slot.mint,
            await fetchProjectTokenDisplay(slot.mint, {
              liquid: true,
              tokenImageUrl: slot.tokenImageUrl,
              tokenName: slot.tokenName,
            }),
          );
        }),
    );

    const needsHeliusSol =
      !byMint.get(WRAPPED_SOL_MINT)?.info?.imageUrl?.trim();
    const solHelius = needsHeliusSol
      ? await fetchHeliusTokenMeta(WRAPPED_SOL_MINT)
      : null;

    const items: TickerItem[] = slots.map((slot) => {
      const { mint, projectSlug, projectName } = slot;
      const row = byMint.get(mint);
      const priceUsd = resolveTokenUsdPrice(mint, row, jupUsd[mint] ?? null);

      if (mint === WRAPPED_SOL_MINT) {
        const dexLogo = normalizeImageUrl(row?.info?.imageUrl);
        const heliusLogo = normalizeImageUrl(solHelius?.image);
        return {
          mint,
          symbol: "SOL",
          priceUsd,
          logoUrl: dexLogo || heliusLogo || null,
          projectSlug,
          projectName,
        };
      }

      const display = projectDisplayByMint.get(mint);
      let symbol = display?.symbol || row?.baseToken?.symbol?.trim() || abbrevMint(mint);
      if (symbol.length > 12) symbol = symbol.slice(0, 12);

      return {
        mint,
        symbol,
        priceUsd,
        logoUrl: display?.logoUrl ?? null,
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
