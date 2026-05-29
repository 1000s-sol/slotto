import {
  fetchTokenUsdPrices,
  usdPriceFromTickerItems,
  WRAPPED_SOL_MINT,
  type TickerPriceItem,
} from "@/lib/token-usd-prices";
import { LIQUID_TICKET_SOL_LAMPORTS } from "./spl-pricing";

export { WRAPPED_SOL_MINT };

/**
 * SPL base units per ticket from USD spot prices (≈95% of 0.01 SOL notional).
 */
export function liquidSplBaseUnitsFromUsdPrices(
  solUsd: number,
  tokenUsd: number,
  mintDecimals: number,
): bigint {
  if (solUsd <= 0 || tokenUsd <= 0) {
    throw new Error(
      "Could not fetch a USD price for this token. Try again or use a fixed-price mint.",
    );
  }

  const targetUsd = (LIQUID_TICKET_SOL_LAMPORTS / 1e9) * solUsd;
  const tokensPerTicket = targetUsd / tokenUsd;
  const base = BigInt(10) ** BigInt(mintDecimals);
  const raw = tokensPerTicket * Number(base);
  if (!Number.isFinite(raw) || raw < 1) {
    throw new Error("Quoted token amount per ticket is too small.");
  }
  return BigInt(Math.ceil(raw));
}

/**
 * SPL base units per ticket for liquid mints (≈95% of 0.01 SOL at quote time).
 * Uses the same Dex + Jupiter sources as the site ticker banner.
 */
export async function fetchLiquidSplPricePerTicket(
  mint: string,
  mintDecimals: number,
): Promise<bigint> {
  const prices = await fetchTokenUsdPrices([WRAPPED_SOL_MINT, mint]);
  const solUsd = prices.get(WRAPPED_SOL_MINT);
  const tokenUsd = prices.get(mint);
  if (solUsd == null || tokenUsd == null) {
    throw new Error(
      "Could not fetch a USD price for this token. Try again or use a fixed-price mint.",
    );
  }
  return liquidSplBaseUnitsFromUsdPrices(solUsd, tokenUsd, mintDecimals);
}

/** Quote from preloaded ticker banner prices (avoids duplicate API calls in the browser). */
export function liquidSplPriceFromTickerItems(
  items: TickerPriceItem[],
  mint: string,
  mintDecimals: number,
): bigint {
  const solUsd = usdPriceFromTickerItems(items, WRAPPED_SOL_MINT);
  const tokenUsd = usdPriceFromTickerItems(items, mint);
  if (solUsd == null || tokenUsd == null) {
    throw new Error(
      "Price not available in ticker feed yet. Wait a moment and try again.",
    );
  }
  return liquidSplBaseUnitsFromUsdPrices(solUsd, tokenUsd, mintDecimals);
}

/** Headroom max for on-chain `price_per_ticket` cap on liquid rows (110% of spot quote). */
export async function fetchLiquidSplMaxPricePerTicket(
  mint: string,
  mintDecimals: number,
): Promise<bigint> {
  const spot = await fetchLiquidSplPricePerTicket(mint, mintDecimals);
  return (spot * BigInt(110)) / BigInt(100);
}

export function liquidSplMaxPriceFromTickerItems(
  items: TickerPriceItem[],
  mint: string,
  mintDecimals: number,
): bigint {
  const spot = liquidSplPriceFromTickerItems(items, mint, mintDecimals);
  return (spot * BigInt(110)) / BigInt(100);
}
