import { fetchMintDecimals } from "./fetch-mint-decimals";
import { liquidSplPriceFromTickerItems } from "./liquid-ticket-price";
import { splBaseUnitsToUi } from "./spl-price";
import {
  fetchTokenUsdPrices,
  WRAPPED_SOL_MINT,
  type TickerPriceItem,
} from "@/lib/token-usd-prices";

export type LiquidTicketPricePreview = {
  mint: string;
  decimals: number;
  priceUi: string;
  pricePerTicketBase: string;
};

/** Spot ticket price per liquid mint (ticker feed, ≈95% of 0.01 SOL). */
export async function previewLiquidTicketPrices(
  mints: string[],
  tickerItems?: TickerPriceItem[],
): Promise<LiquidTicketPricePreview[]> {
  if (!mints.length) return [];

  const items =
    tickerItems ??
    (await (async () => {
      const unique = [...new Set([WRAPPED_SOL_MINT, ...mints])];
      const map = await fetchTokenUsdPrices(unique);
      return unique.map((mint) => ({
        mint,
        priceUsd: map.get(mint) ?? null,
      }));
    })());

  const out: LiquidTicketPricePreview[] = [];
  for (const mint of mints) {
    const decimals = await fetchMintDecimals(mint);
    const base = liquidSplPriceFromTickerItems(items, mint, decimals);
    out.push({
      mint,
      decimals,
      pricePerTicketBase: base.toString(),
      priceUi: splBaseUnitsToUi(base.toString(), decimals),
    });
  }
  return out;
}
