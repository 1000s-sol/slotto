import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import type { SplMintDraft } from "./spl-types";
import { normalizeSplDisplayCap } from "./spl-display-cap";

export async function loadSplCatalogForNewDraw(): Promise<SplMintDraft[]> {
  const catalog = await prisma.lotterySplCatalogEntry.findMany({
    orderBy: [{ sortOrder: "asc" }, { symbol: "asc" }],
  });
  return catalog.map((c) => ({
    mint: c.mint,
    symbol: c.symbol ?? "",
    label: c.label ?? c.symbol ?? c.mint.slice(0, 8),
    mintDecimals: c.mintDecimals,
    priceUi: "",
    pricePerTicket: c.pricePerTicket,
    onChainCap: c.defaultOnChainCap,
    displayCap: normalizeSplDisplayCap(c.defaultDisplayCap, c.defaultOnChainCap),
    published: c.defaultPublished,
    purchasesLocked: false,
    pricingMode: "fixed",
    enabled: true,
  }));
}

export async function saveSplRowsForDraw(
  onChainDrawId: number,
  rows: SplMintDraft[],
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.lotteryDrawSplMint.deleteMany({ where: { onChainDrawId } });
    for (let i = 0; i < rows.length; i += 1) {
      const r = rows[i];
      await tx.lotteryDrawSplMint.create({
        data: {
          onChainDrawId,
          mint: r.mint,
          onChainCap: r.onChainCap,
          displayCap: normalizeSplDisplayCap(r.displayCap, r.onChainCap),
          published: r.published,
          purchasesLocked: r.purchasesLocked,
          symbol: r.symbol || null,
          pricePerTicket: r.pricePerTicket,
          mintDecimals: r.mintDecimals,
        },
      });
      await tx.lotterySplCatalogEntry.upsert({
        where: { mint: r.mint },
        create: {
          mint: r.mint,
          symbol: r.symbol || null,
          label: r.label || null,
          mintDecimals: r.mintDecimals,
          pricePerTicket: r.pricePerTicket,
          defaultOnChainCap: r.onChainCap,
          defaultDisplayCap: normalizeSplDisplayCap(r.displayCap, r.onChainCap),
          defaultPublished: r.published,
          sortOrder: i,
        },
        update: {
          symbol: r.symbol || null,
          label: r.label || null,
          mintDecimals: r.mintDecimals,
          pricePerTicket: r.pricePerTicket,
          defaultOnChainCap: r.onChainCap,
          defaultDisplayCap: normalizeSplDisplayCap(r.displayCap, r.onChainCap),
          defaultPublished: r.published,
          sortOrder: i,
        },
      });
    }
  });
}

export async function fetchSplMintRowsForDraw(onChainDrawId: number) {
  return prisma.lotteryDrawSplMint.findMany({
    where: { onChainDrawId },
    orderBy: { mint: "asc" },
  });
}

/** Fix draw rows where UI cap was never set (still 500/500). Persists 60 to Postgres. */
export async function healDrawSplDisplayCaps(onChainDrawId: number): Promise<number> {
  const rows = await fetchSplMintRowsForDraw(onChainDrawId);
  let healed = 0;
  for (const r of rows) {
    const normalized = normalizeSplDisplayCap(r.displayCap, r.onChainCap);
    if (normalized !== r.displayCap) {
      await updateDrawSplMintRow(onChainDrawId, r.mint, { displayCap: normalized });
      healed += 1;
    }
  }
  return healed;
}

export async function updateDrawSplMintRow(
  onChainDrawId: number,
  mint: string,
  data: Partial<{
    displayCap: number;
    published: boolean;
    purchasesLocked: boolean;
  }>,
) {
  const row = await prisma.lotteryDrawSplMint.findUnique({
    where: {
      onChainDrawId_mint: { onChainDrawId, mint },
    },
  });
  if (!row) throw new Error("Mint row not found for this draw");
  if (data.displayCap !== undefined) {
    if (data.displayCap > row.onChainCap) {
      throw new Error("display_cap cannot exceed on-chain cap");
    }
    if (data.displayCap < 0) {
      throw new Error("display_cap must be non-negative");
    }
  }
  return prisma.lotteryDrawSplMint.update({
    where: { onChainDrawId_mint: { onChainDrawId, mint } },
    data,
  });
}

export type DrawSplMintSettingsPatch = {
  mint: string;
  displayCap?: number;
  published?: boolean;
  purchasesLocked?: boolean;
};

export async function batchUpdateDrawSplMintRows(
  onChainDrawId: number,
  patches: DrawSplMintSettingsPatch[],
): Promise<void> {
  for (const patch of patches) {
    const { mint, ...data } = patch;
    if (
      data.displayCap === undefined &&
      data.published === undefined &&
      data.purchasesLocked === undefined
    ) {
      continue;
    }
    await updateDrawSplMintRow(onChainDrawId, mint, data);
  }
}

export async function appendDrawSplMintRow(
  onChainDrawId: number,
  row: SplMintDraft,
) {
  return prisma.lotteryDrawSplMint.create({
    data: {
      onChainDrawId,
      mint: row.mint,
      onChainCap: row.onChainCap,
      displayCap: normalizeSplDisplayCap(row.displayCap, row.onChainCap),
      published: row.published,
      purchasesLocked: row.purchasesLocked,
      symbol: row.symbol || null,
      pricePerTicket: row.pricePerTicket,
      mintDecimals: row.mintDecimals,
    },
  });
}
