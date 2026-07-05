import { Connection, PublicKey } from "@solana/web3.js";

import type { LotteryDrawView } from "./chain";
import { chainUnixTs, fetchDrawById, fetchJackpotLamports } from "./chain";
import { DrawState } from "./constants";
import {
  formatDrawDisplayLabel,
  getDrawDisplayMeta,
} from "./draw-display-db";
import { globalConfigPda } from "./pdas";
import { createLotteryReadOnlyProgram } from "./program";
import {
  fetchDrawCount,
  fetchInProgressDraw,
  fetchSettledDrawPrizeLamports,
  lotteryDrawViewToJson,
  type LotteryDrawViewJson,
} from "./draws";
import { isPastWinnerDrawVisible } from "./past-winners-filter";
import { shouldExposeActiveDrawToPublic } from "./test-mode";

export type LotteryStateFetchOptions = {
  /** Preview page (`/preview/...`) — show the live test draw while LOTTERY_TEST_MODE. */
  preview?: boolean;
};

export type LotteryStateSnapshot = {
  activeDraw: LotteryDrawViewJson | null;
  settledDraw: LotteryDrawViewJson | null;
  settledDrawPrizeLamports: number | null;
  jackpotLamports: number | null;
  nowSec: number;
  teamVault: string;
  buxVault: string;
  setupVault: string;
};

async function enrichDrawJson(
  draw: LotteryDrawView,
): Promise<LotteryDrawViewJson> {
  const meta = await getDrawDisplayMeta(draw.drawId);
  const base = lotteryDrawViewToJson(draw);
  if (!meta) {
    return {
      ...base,
      displayLabel: `TEST-${draw.drawId}`,
      isTestDraw: true,
      displayNumber: null,
    };
  }
  return {
    ...base,
    displayLabel: formatDrawDisplayLabel(meta),
    isTestDraw: meta.kind === "TEST",
    displayNumber: meta.displayNumber,
  };
}

/** Server-side snapshot for homepage (one RPC pass, no browser Helius spam). */
export async function fetchLotteryState(
  connection: Connection,
  programId: PublicKey,
  options?: LotteryStateFetchOptions,
): Promise<LotteryStateSnapshot> {
  const inProgress = await fetchInProgressDraw(connection, programId);
  const showActiveDraw = shouldExposeActiveDrawToPublic(options);
  let jackpotLamports: number | null = null;
  let settledDraw: LotteryDrawViewJson | null = null;
  let settledDrawPrizeLamports: number | null = null;

  if (inProgress && showActiveDraw) {
    if (inProgress.state === DrawState.Selling) {
      jackpotLamports = await fetchJackpotLamports(
        connection,
        inProgress.prizeVault,
      );
    }
  } else {
    const n = await fetchDrawCount(connection, programId);
    let settled: LotteryDrawView | null = null;
    for (let id = n - 1; id >= 0; id -= 1) {
      const candidate = await fetchDrawById(connection, programId, id);
      if (candidate?.state !== DrawState.Settled || !candidate.winner) continue;
      if (!(await isPastWinnerDrawVisible(candidate.drawId))) continue;
      settled = candidate;
      break;
    }
    if (settled) {
      settledDraw = await enrichDrawJson(settled);
      settledDrawPrizeLamports = await fetchSettledDrawPrizeLamports(
        connection,
        settled,
      );
    }
  }

  const nowSec = await chainUnixTs(connection);

  const program = createLotteryReadOnlyProgram(connection);
  const cfg = await program.account.globalConfig.fetch(
    globalConfigPda(programId),
  );

  return {
    activeDraw:
      inProgress && showActiveDraw ? await enrichDrawJson(inProgress) : null,
    settledDraw,
    settledDrawPrizeLamports,
    jackpotLamports,
    nowSec,
    teamVault: cfg.teamVault.toBase58(),
    buxVault: cfg.buxVault.toBase58(),
    setupVault: cfg.setupVault.toBase58(),
  };
}
