"use server";

import { currentAdminAddress } from "@/lib/admin-session";
import { fetchDrawById } from "@/lib/lottery/chain";
import {
  lotteryClusterLabel,
  resolveLotteryClusterEnv,
} from "@/lib/lottery/cluster";
import { lotteryProgramId } from "@/lib/lottery/config";
import { globalConfigPda } from "@/lib/lottery/pdas";
import { createLotteryReadOnlyProgram } from "@/lib/lottery/program";
import {
  resolveLotteryCluster,
  resolvePublicSolanaRpcUrl,
} from "@/lib/lottery/rpc-url";
import { withLotteryServerRpc } from "@/lib/lottery/server-rpc";
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

/** Official @slottogg_ "draw is live" post (no-op unless X posting is configured). */
export async function adminAnnounceDrawLiveAction(
  drawId: number,
  seedLamports?: number,
  salesCloseTs?: number,
): Promise<{ ok: true }> {
  await requireAdmin();
  try {
    const { announceDrawLive } = await import("@/lib/lottery/announce-draw");
    await announceDrawLive({ drawId, seedLamports, salesCloseTs });
  } catch (e) {
    console.warn("[lottery announce] live hook failed:", e);
  }
  return { ok: true };
}

export type AdminGlobalConfigView = {
  globalConfigPda: string;
  authority: string;
  teamVault: string;
  buxVault: string;
  setupVault: string;
  nextDrawId: string;
};

/** Safe browser/wallet RPC endpoint (no Helius api-key; used by admin signing). */
export async function adminFetchWalletRpcEndpointAction(): Promise<string> {
  await requireAdmin();
  return resolvePublicSolanaRpcUrl();
}

/** Cluster the server uses for lottery reads/crank (from actual RPC URL, not env label alone). */
export async function adminFetchServerLotteryClusterAction(): Promise<{
  cluster: "devnet" | "mainnet-beta";
  label: string;
  envLabel: string;
  rpcEnvMismatch: boolean;
}> {
  await requireAdmin();
  const cluster = resolveLotteryCluster();
  const envCluster = resolveLotteryClusterEnv();
  return {
    cluster,
    label: lotteryClusterLabel(cluster),
    envLabel: lotteryClusterLabel(envCluster),
    rpcEnvMismatch: cluster !== envCluster,
  };
}

/** True if draw account exists on the server cluster (post-create verification). */
export async function adminDrawExistsOnServerAction(
  drawId: number,
): Promise<boolean> {
  await requireAdmin();
  if (!Number.isFinite(drawId) || drawId < 0) return false;
  return withLotteryServerRpc(async (connection) => {
    const draw = await fetchDrawById(connection, lotteryProgramId(), drawId);
    return draw != null;
  });
}

/** Read global config via server RPC (matches `LOTTERY_CLUSTER` / Helius). */
export async function adminFetchGlobalConfigAction(): Promise<AdminGlobalConfigView | null> {
  await requireAdmin();
  const programId = lotteryProgramId();
  const globalConfig = globalConfigPda(programId);
  return withLotteryServerRpc(async (connection) => {
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
  });
}

/** Active draw using server RPC (matches `LOTTERY_CLUSTER`, not browser wallet RPC). */
export async function adminFetchInProgressDrawAction(): Promise<LotteryDrawViewJson | null> {
  await requireAdmin();
  return withLotteryServerRpc(async (connection) => {
    const draw = await fetchInProgressDraw(connection, lotteryProgramId());
    return draw ? lotteryDrawViewToJson(draw) : null;
  });
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
