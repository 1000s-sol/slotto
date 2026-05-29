"use server";

import { Connection } from "@solana/web3.js";

import { currentAdminAddress } from "@/lib/admin-session";
import { lotteryProgramId } from "@/lib/lottery/config";
import { globalConfigPda } from "@/lib/lottery/pdas";
import { createLotteryReadOnlyProgram } from "@/lib/lottery/program";
import { resolveLotteryRpcUrl } from "@/lib/lottery/rpc-url";
import {
  appendDrawSplMintRow,
  batchUpdateDrawSplMintRows,
  fetchSplMintRowsForDraw,
  loadSplCatalogForNewDraw,
  saveSplRowsForDraw,
  updateDrawSplMintRow,
  type DrawSplMintSettingsPatch,
} from "@/lib/lottery/spl-catalog-db";
import {
  fetchInProgressDraw,
  lotteryDrawViewToJson,
  type LotteryDrawViewJson,
} from "@/lib/lottery/draws";
import { mintsExistOnCluster } from "@/lib/lottery/mints-on-cluster";
import {
  buildSplMintDraftsForCreateDraw,
  fetchPublishedProjectTokens,
  type ProjectTokenDrawSettings,
} from "@/lib/lottery/project-tokens-for-draw";
import type { SplMintDraft } from "@/lib/lottery/spl-types";

async function requireAdmin() {
  const admin = await currentAdminAddress();
  if (!admin) throw new Error("Unauthorized");
  return admin;
}

export type AdminGlobalConfigView = {
  globalConfigPda: string;
  authority: string;
  teamVault: string;
  buxVault: string;
  setupVault: string;
  nextDrawId: string;
};

/** Read global config via server RPC (matches `LOTTERY_CLUSTER` / Helius). */
export async function adminFetchGlobalConfigAction(): Promise<AdminGlobalConfigView | null> {
  await requireAdmin();
  const programId = lotteryProgramId();
  const globalConfig = globalConfigPda(programId);
  const connection = new Connection(resolveLotteryRpcUrl(), "confirmed");
  const info = await connection.getAccountInfo(globalConfig);
  if (!info) return null;

  const program = createLotteryReadOnlyProgram(connection);
  const cfg = await program.account.globalConfig.fetch(globalConfig);
  return {
    globalConfigPda: globalConfig.toBase58(),
    authority: cfg.authority.toBase58(),
    teamVault: cfg.teamVault.toBase58(),
    buxVault: cfg.buxVault.toBase58(),
    setupVault: cfg.setupVault.toBase58(),
    nextDrawId: cfg.nextDrawId.toString(),
  };
}

/** Active draw using server RPC (matches `LOTTERY_CLUSTER`, not browser wallet RPC). */
export async function adminFetchInProgressDrawAction(): Promise<LotteryDrawViewJson | null> {
  await requireAdmin();
  const connection = new Connection(resolveLotteryRpcUrl(), "confirmed");
  const draw = await fetchInProgressDraw(connection, lotteryProgramId());
  return draw ? lotteryDrawViewToJson(draw) : null;
}

export async function adminLoadSplCatalogAction(): Promise<SplMintDraft[]> {
  await requireAdmin();
  return loadSplCatalogForNewDraw();
}

export async function adminFetchProjectTokensForDrawAction() {
  await requireAdmin();
  return fetchPublishedProjectTokens();
}

export async function adminPreviewLiquidTicketPricesAction(mints: string[]) {
  await requireAdmin();
  const unique = [...new Set(mints.map((m) => m.trim()).filter(Boolean))];
  const { previewLiquidTicketPrices } = await import(
    "@/lib/lottery/preview-liquid-ticket-prices"
  );
  return previewLiquidTicketPrices(unique);
}

export async function adminBuildSplMintDraftsForCreateDrawAction(
  enabled: Record<string, boolean>,
  settings: Record<string, ProjectTokenDrawSettings>,
): Promise<SplMintDraft[]> {
  await requireAdmin();
  const tokens = await fetchPublishedProjectTokens();
  return buildSplMintDraftsForCreateDraw(tokens, enabled, settings);
}

export async function adminMintsExistOnClusterAction(
  mints: string[],
): Promise<Record<string, boolean>> {
  await requireAdmin();
  return mintsExistOnCluster(mints);
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

export async function adminBatchUpdateDrawSplSettingsAction(
  onChainDrawId: number,
  patches: DrawSplMintSettingsPatch[],
): Promise<{ ok: true }> {
  await requireAdmin();
  if (!Number.isFinite(onChainDrawId) || onChainDrawId < 0) {
    throw new Error("Invalid draw id");
  }
  await batchUpdateDrawSplMintRows(onChainDrawId, patches);
  return { ok: true };
}

export async function adminAppendDrawSplMintDbAction(
  onChainDrawId: number,
  row: SplMintDraft,
) {
  await requireAdmin();
  return appendDrawSplMintRow(onChainDrawId, row);
}
