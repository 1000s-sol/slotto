"use server";

import { currentAdminAddress } from "@/lib/admin-session";
import {
  appendDrawSplMintRow,
  fetchSplMintRowsForDraw,
  loadSplCatalogForNewDraw,
  saveSplRowsForDraw,
  updateDrawSplMintRow,
} from "@/lib/lottery/spl-catalog-db";
import type { SplMintDraft } from "@/lib/lottery/spl-types";

async function requireAdmin() {
  const admin = await currentAdminAddress();
  if (!admin) throw new Error("Unauthorized");
  return admin;
}

export async function adminLoadSplCatalogAction(): Promise<SplMintDraft[]> {
  await requireAdmin();
  return loadSplCatalogForNewDraw();
}

export async function adminSaveSplRowsForDrawAction(
  onChainDrawId: number,
  rows: SplMintDraft[],
): Promise<{ ok: true }> {
  await requireAdmin();
  if (!Number.isFinite(onChainDrawId) || onChainDrawId < 0) {
    throw new Error("Invalid draw id");
  }
  await saveSplRowsForDraw(onChainDrawId, rows);
  return { ok: true };
}

export async function adminFetchDrawSplRowsAction(onChainDrawId: number) {
  await requireAdmin();
  return fetchSplMintRowsForDraw(onChainDrawId);
}

export async function adminUpdateDrawSplMintAction(
  onChainDrawId: number,
  mint: string,
  data: {
    displayCap?: number;
    published?: boolean;
    purchasesLocked?: boolean;
  },
) {
  await requireAdmin();
  return updateDrawSplMintRow(onChainDrawId, mint, data);
}

export async function adminAppendDrawSplMintDbAction(
  onChainDrawId: number,
  row: SplMintDraft,
) {
  await requireAdmin();
  return appendDrawSplMintRow(onChainDrawId, row);
}
