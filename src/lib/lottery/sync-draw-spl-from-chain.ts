import { Connection, PublicKey } from "@solana/web3.js";

import { fetchDrawById } from "./chain";
import {
  FREE_ENTRY_CAP,
  FREE_ENTRY_MINT,
  FREE_ENTRY_NAME,
  FREE_ENTRY_SYMBOL,
} from "./free-entry";
import { pricingModeFromChain } from "./spl-types";
import { saveSplRowsForDraw } from "./spl-catalog-db";
import { prisma } from "@/lib/prisma";
import type { SplMintDraft } from "./spl-types";

export function splDbMintsMatchChain(
  dbMints: string[],
  chainMints: string[],
): boolean {
  if (dbMints.length !== chainMints.length) return false;
  const dbSet = new Set(dbMints);
  return chainMints.every((m) => dbSet.has(m));
}

/** Overwrite Postgres SPL rows for a draw from on-chain state (labels from projects). */
export async function syncDrawSplRowsFromChain(
  connection: Connection,
  programId: PublicKey,
  drawId: number,
): Promise<SplMintDraft[]> {
  const draw = await fetchDrawById(connection, programId, drawId);
  if (!draw) {
    throw new Error(`Draw #${drawId} not found on chain`);
  }

  const [projects, existingRows, catalog] = await Promise.all([
    prisma.project.findMany({
      where: { NOT: { tokenMint: null } },
      select: { name: true, tokenName: true, tokenMint: true },
    }),
    prisma.lotteryDrawSplMint.findMany({ where: { onChainDrawId: drawId } }),
    prisma.lotterySplCatalogEntry.findMany(),
  ]);
  const byMint = new Map(projects.map((p) => [p.tokenMint as string, p]));
  const existingByMint = new Map(existingRows.map((r) => [r.mint, r]));
  const catalogByMint = new Map(catalog.map((c) => [c.mint, c]));

  const drafts: SplMintDraft[] = draw.splMints.map((m) => {
    if (FREE_ENTRY_MINT && m.mint === FREE_ENTRY_MINT) {
      const prev = existingByMint.get(m.mint);
      return {
        mint: m.mint,
        symbol: FREE_ENTRY_SYMBOL,
        label: FREE_ENTRY_NAME,
        mintDecimals: m.decimals,
        pricingMode: pricingModeFromChain(m.pricingMode),
        priceUi: "1",
        pricePerTicket: m.pricePerTicket,
        onChainCap: m.cap,
        displayCap: prev
          ? Math.min(prev.displayCap, m.cap)
          : Math.min(FREE_ENTRY_CAP, m.cap),
        published: prev?.published ?? true,
        purchasesLocked: prev?.purchasesLocked ?? false,
        enabled: true,
      };
    }
    const p = byMint.get(m.mint);
    const prev = existingByMint.get(m.mint);
    const cat = catalogByMint.get(m.mint);
    const name = p?.name ?? m.mint.slice(0, 8);
    const symbol = p?.tokenName ?? p?.name ?? m.mint.slice(0, 8);
    const defaultDisplayCap = cat?.defaultDisplayCap ?? m.cap;
    return {
      mint: m.mint,
      symbol,
      label: name,
      mintDecimals: m.decimals,
      pricingMode: pricingModeFromChain(m.pricingMode),
      priceUi: "",
      pricePerTicket: m.pricePerTicket,
      onChainCap: m.cap,
      displayCap: prev
        ? Math.min(prev.displayCap, m.cap)
        : Math.min(defaultDisplayCap, m.cap),
      published: prev?.published ?? cat?.defaultPublished ?? true,
      purchasesLocked: prev?.purchasesLocked ?? false,
      enabled: true,
    };
  });

  await saveSplRowsForDraw(drawId, drafts);
  return drafts;
}
