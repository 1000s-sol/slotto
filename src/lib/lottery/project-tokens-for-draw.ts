import { prisma } from "@/lib/prisma";
import { fetchMintDecimals } from "./fetch-mint-decimals";
import { liquidSplMaxPriceFromTickerItems } from "./liquid-ticket-price";
import {
  fetchTokenUsdPrices,
  WRAPPED_SOL_MINT,
  type TickerPriceItem,
} from "@/lib/token-usd-prices";
import { SPL_PRICING_FIXED, SPL_PRICING_LIQUID_DYNAMIC } from "./spl-pricing";
import type { SplMintDraft } from "./spl-types";
import { splBaseUnitsToUi, splUiAmountToBaseUnits } from "./spl-price";

export type ProjectTokenForDraw = {
  projectSlug: string;
  projectName: string;
  mint: string;
  liquid: boolean;
  tokenName: string | null;
  tokenImageUrl: string | null;
};

export async function fetchPublishedProjectTokens(): Promise<
  ProjectTokenForDraw[]
> {
  const rows = await prisma.project.findMany({
    where: { published: true, NOT: { tokenMint: null } },
    select: {
      slug: true,
      name: true,
      tokenMint: true,
      tokenLiquid: true,
      tokenName: true,
      tokenImageUrl: true,
    },
    orderBy: { name: "asc" },
  });

  const out: ProjectTokenForDraw[] = [];
  for (const r of rows) {
    const mint = r.tokenMint?.trim();
    if (!mint) continue;
    out.push({
      projectSlug: r.slug,
      projectName: r.name,
      mint,
      liquid: r.tokenLiquid,
      tokenName: r.tokenName,
      tokenImageUrl: r.tokenImageUrl,
    });
  }
  return out;
}

export type ProjectTokenDrawSettings = {
  onChainCap: number;
  displayCap: number;
  published: boolean;
  priceUi: string;
};

/** Build SPL rows for create_draw (server RPC — avoids browser Helius 403). */
export async function buildSplMintDraftsForCreateDraw(
  tokens: ProjectTokenForDraw[],
  enabled: Record<string, boolean>,
  settings: Record<string, ProjectTokenDrawSettings>,
): Promise<SplMintDraft[]> {
  const enabledTokens = tokens.filter((t) => enabled[t.mint]);
  const mints = [
    WRAPPED_SOL_MINT,
    ...enabledTokens.map((t) => t.mint),
  ];
  const usdMap = await fetchTokenUsdPrices(mints);
  const tickerItems: TickerPriceItem[] = mints.map((mint) => ({
    mint,
    priceUsd: usdMap.get(mint) ?? null,
  }));

  const drafts: SplMintDraft[] = [];

  for (const t of enabledTokens) {
    const s = settings[t.mint];
    if (!s) continue;

    const decimals = await fetchMintDecimals(t.mint);
    const pricingMode = t.liquid ? "liquidDynamic" : "fixed";

    let pricePerTicket: string;
    let priceUi: string;

    if (t.liquid) {
      const max = liquidSplMaxPriceFromTickerItems(tickerItems, t.mint, decimals);
      pricePerTicket = max.toString();
      const spot = (max * BigInt(100)) / BigInt(110);
      priceUi = splBaseUnitsToUi(spot.toString(), decimals);
    } else {
      pricePerTicket = splUiAmountToBaseUnits(s.priceUi || "1", decimals).toString();
      priceUi = s.priceUi || "1";
    }

    drafts.push({
      mint: t.mint,
      symbol: t.tokenName ?? t.projectName.slice(0, 8),
      label: t.projectName,
      mintDecimals: decimals,
      pricingMode,
      priceUi,
      pricePerTicket,
      onChainCap: s.onChainCap,
      displayCap: Math.min(s.displayCap, s.onChainCap),
      published: s.published,
      purchasesLocked: false,
      enabled: true,
    });
  }

  return drafts;
}

export function splMintDraftToOnChainArg(row: SplMintDraft) {
  return {
    mint: row.mint,
    pricePerTicket: row.pricePerTicket,
    mintDecimals: row.mintDecimals,
    cap: row.onChainCap,
    pricingMode:
      row.pricingMode === "liquidDynamic"
        ? SPL_PRICING_LIQUID_DYNAMIC
        : SPL_PRICING_FIXED,
  };
}
