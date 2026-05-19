import type { SplMintRowView } from "./chain";
import type { SplMintUiRow } from "./spl-types";

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
    const remaining = Math.max(0, effectiveCap - chain.sold);
    out.push({
      mint: chain.mint,
      symbol: db?.symbol ?? chain.mint.slice(0, 4),
      cap: chain.cap,
      sold: chain.sold,
      displayCap: effectiveCap,
      pricePerTicket: chain.pricePerTicket,
      decimals: chain.decimals,
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
