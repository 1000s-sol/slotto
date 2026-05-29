import type { SplMintRowView } from "./chain";
import { MAX_SOL_TICKETS_PER_BUY } from "./constants";
import type { SplMintUiRow } from "./spl-types";

/** SPL tickets still available for this mint (display cap minus on-chain sold). */
export function splTicketsRemaining(
  row: Pick<SplMintUiRow, "displayCap" | "sold">,
): number {
  return Math.max(0, row.displayCap - row.sold);
}

/** Max tickets the user may buy in one tx for the current pay-with selection. */
export function maxBuyableTicketsForPayWith(
  payWith: "SOL" | string,
  splUiRows: SplMintUiRow[],
  perTxMax = MAX_SOL_TICKETS_PER_BUY,
): number {
  if (payWith === "SOL") return perTxMax;
  const row = splUiRows.find((o) => o.mint === payWith);
  if (!row) return 1;
  return Math.min(perTxMax, splTicketsRemaining(row));
}

/** Clamp ticket count to [1, maxBuyable] for the selected payment method. */
export function clampTicketCountForPayWith(
  count: number,
  payWith: "SOL" | string,
  splUiRows: SplMintUiRow[],
  perTxMax = MAX_SOL_TICKETS_PER_BUY,
): number {
  const max = maxBuyableTicketsForPayWith(payWith, splUiRows, perTxMax);
  if (max < 1) return 1;
  const n = Number.isFinite(count) ? Math.floor(count) : 1;
  return Math.min(max, Math.max(1, n));
}

type DbRow = {
  mint: string;
  symbol: string | null;
  onChainCap: number;
  displayCap: number;
  published: boolean;
  purchasesLocked: boolean;
  pricePerTicket: string;
  mintDecimals: number;
};

/** Merge on-chain SPL rows with Postgres display caps and flags. */
export function mergeSplMintsForBuyUi(
  chainRows: SplMintRowView[],
  dbRows: DbRow[],
  buyable: boolean,
): SplMintUiRow[] {
  const dbByMint = new Map(dbRows.map((r) => [r.mint, r]));
  const out: SplMintUiRow[] = [];

  for (const chain of chainRows) {
    const db = dbByMint.get(chain.mint);
    const displayCap = db?.displayCap ?? chain.cap;
    const published = db?.published ?? false;
    const purchasesLocked = db?.purchasesLocked ?? false;
    const effectiveCap = Math.min(chain.cap, displayCap);
    const remaining = splTicketsRemaining({
      displayCap: effectiveCap,
      sold: chain.sold,
    });
    out.push({
      mint: chain.mint,
      symbol: db?.symbol ?? chain.mint.slice(0, 4),
      cap: chain.cap,
      sold: chain.sold,
      displayCap: effectiveCap,
      pricePerTicket: chain.pricePerTicket,
      decimals: chain.decimals,
      pricingMode: chain.pricingMode,
      published,
      purchasesLocked,
      buyable:
        buyable &&
        published &&
        !purchasesLocked &&
        remaining > 0 &&
        chain.sold < chain.cap,
    });
  }

  return out.sort((a, b) => a.symbol.localeCompare(b.symbol));
}
