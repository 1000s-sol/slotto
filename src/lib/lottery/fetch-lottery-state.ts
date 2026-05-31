import { Connection, PublicKey } from "@solana/web3.js";

import { chainUnixTs, fetchJackpotLamports } from "./chain";
import { DrawState } from "./constants";
import { globalConfigPda } from "./pdas";
import { createLotteryReadOnlyProgram } from "./program";
import {
  fetchInProgressDraw,
  fetchLatestSettledDraw,
  fetchSettledDrawPrizeLamports,
  lotteryDrawViewToJson,
  type LotteryDrawViewJson,
} from "./draws";

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

/** Server-side snapshot for homepage (one RPC pass, no browser Helius spam). */
export async function fetchLotteryState(
  connection: Connection,
  programId: PublicKey,
): Promise<LotteryStateSnapshot> {
  const inProgress = await fetchInProgressDraw(connection, programId);
  let jackpotLamports: number | null = null;
  let settledDraw: LotteryDrawViewJson | null = null;
  let settledDrawPrizeLamports: number | null = null;

  if (inProgress) {
    if (inProgress.state === DrawState.Selling) {
      jackpotLamports = await fetchJackpotLamports(
        connection,
        inProgress.prizeVault,
      );
    }
  } else {
    const settled = await fetchLatestSettledDraw(connection, programId);
    if (settled) {
      settledDraw = lotteryDrawViewToJson(settled);
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
    activeDraw: inProgress ? lotteryDrawViewToJson(inProgress) : null,
    settledDraw,
    settledDrawPrizeLamports,
    jackpotLamports,
    nowSec,
    teamVault: cfg.teamVault.toBase58(),
    buxVault: cfg.buxVault.toBase58(),
    setupVault: cfg.setupVault.toBase58(),
  };
}
