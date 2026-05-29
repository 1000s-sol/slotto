import { Connection, PublicKey } from "@solana/web3.js";

import { chainUnixTs, fetchJackpotLamports } from "./chain";
import { DrawState } from "./constants";
import {
  fetchInProgressDraw,
  fetchLatestSettledDraw,
  lotteryDrawViewToJson,
  type LotteryDrawViewJson,
} from "./draws";

export type LotteryStateSnapshot = {
  activeDraw: LotteryDrawViewJson | null;
  settledDraw: LotteryDrawViewJson | null;
  jackpotLamports: number | null;
  nowSec: number;
};

/** Server-side snapshot for homepage (one RPC pass, no browser Helius spam). */
export async function fetchLotteryState(
  connection: Connection,
  programId: PublicKey,
): Promise<LotteryStateSnapshot> {
  const inProgress = await fetchInProgressDraw(connection, programId);
  let jackpotLamports: number | null = null;
  let settledDraw: LotteryDrawViewJson | null = null;

  if (inProgress) {
    if (inProgress.state === DrawState.Selling) {
      jackpotLamports = await fetchJackpotLamports(
        connection,
        inProgress.prizeVault,
      );
    }
  } else {
    const settled = await fetchLatestSettledDraw(connection, programId);
    settledDraw = settled ? lotteryDrawViewToJson(settled) : null;
  }

  const nowSec = await chainUnixTs(connection);

  return {
    activeDraw: inProgress ? lotteryDrawViewToJson(inProgress) : null,
    settledDraw,
    jackpotLamports,
    nowSec,
  };
}
