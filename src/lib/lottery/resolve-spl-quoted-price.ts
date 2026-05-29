import { Connection, PublicKey } from "@solana/web3.js";

import type { TickerPriceItem } from "@/lib/token-usd-prices";

import type { LotteryDrawView } from "./chain";
import {
  fetchLiquidSplPricePerTicket,
  liquidSplPriceFromTickerItems,
} from "./liquid-ticket-price";
import { SPL_PRICING_LIQUID_DYNAMIC } from "./spl-pricing";

/** Price per ticket in SPL base units for the next `buy_spl_tickets` call. */
export async function resolveSplQuotedPricePerTicket(
  connection: Connection,
  programId: PublicKey,
  draw: LotteryDrawView,
  mint: PublicKey,
  tickerPrices?: TickerPriceItem[],
): Promise<bigint> {
  void connection;
  void programId;

  const chainRow = draw.splMints.find((r) => r.mint === mint.toBase58());
  if (!chainRow) {
    throw new Error("This token is not on the draw.");
  }

  if (chainRow.pricingMode === SPL_PRICING_LIQUID_DYNAMIC) {
    if (tickerPrices?.length) {
      return liquidSplPriceFromTickerItems(
        tickerPrices,
        mint.toBase58(),
        chainRow.decimals,
      );
    }
    return fetchLiquidSplPricePerTicket(mint.toBase58(), chainRow.decimals);
  }

  const onChain = BigInt(chainRow.pricePerTicket);
  if (onChain <= BigInt(0)) {
    throw new Error("Invalid fixed SPL price on draw.");
  }
  return onChain;
}
