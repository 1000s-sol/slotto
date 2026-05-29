import { Connection, PublicKey } from "@solana/web3.js";

import { prisma } from "@/lib/prisma";
import {
  fetchLiquidSplMaxPricePerTicket,
  liquidSplMaxPriceFromTickerItems,
} from "./liquid-ticket-price";
import type { TickerPriceItem } from "@/lib/token-usd-prices";
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

/** Build on-chain + DB rows for enabled project tokens (mint decimals from chain). */
export async function projectTokensToSplMintDrafts(
  connection: Connection,
  tokens: ProjectTokenForDraw[],
  enabled: Record<string, boolean>,
  settings: Record<
    string,
    {
      onChainCap: number;
      displayCap: number;
      published: boolean;
      priceUi: string;
    }
  >,
  tickerPrices?: TickerPriceItem[],
): Promise<SplMintDraft[]> {
  const drafts: SplMintDraft[] = [];

  for (const t of tokens) {
    if (!enabled[t.mint]) continue;
    const s = settings[t.mint];
    if (!s) continue;

    const mintPk = new PublicKey(t.mint);
    const mintInfo = await connection.getParsedAccountInfo(mintPk);
    const decimals =
      mintInfo.value?.data &&
      typeof mintInfo.value.data === "object" &&
      "parsed" in mintInfo.value.data
        ? (mintInfo.value.data.parsed as { info?: { decimals?: number } }).info
            ?.decimals ?? 9
        : 9;

    let pricePerTicket: string;
    let priceUi: string;
    const pricingMode = t.liquid ? "liquidDynamic" : "fixed";

    if (t.liquid) {
      const max = tickerPrices?.length
        ? liquidSplMaxPriceFromTickerItems(tickerPrices, t.mint, decimals)
        : await fetchLiquidSplMaxPricePerTicket(t.mint, decimals);
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
