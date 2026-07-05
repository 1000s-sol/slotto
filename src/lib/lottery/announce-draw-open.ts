import type { Connection, PublicKey } from "@solana/web3.js";

import { announceDrawLiveChannels } from "./announce-draw-live-channels";
import { chainUnixTs, fetchDrawById, fetchJackpotLamports, fetchLotteryDraw } from "./chain";
import { drawSalesHaveOpened } from "./draw-settlement";

export type DrawOpenAnnounceResult = {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  discordPosted?: number;
};

export async function fetchDrawIdsNeedingOpenAnnounce(
  connection: Connection,
  programId: PublicKey,
): Promise<number[]> {
  const draw = await fetchLotteryDraw(connection, programId);
  if (!draw) return [];
  const nowSec = await chainUnixTs(connection);
  if (!drawSalesHaveOpened(draw, nowSec)) return [];
  return [draw.drawId];
}

/** Post draw-live to Discord/X once sales open (idempotent). */
export async function runAnnounceDrawOpenIfNeeded(
  drawId: number,
): Promise<DrawOpenAnnounceResult> {
  const { lotteryProgramId } = await import("./config");
  const { withLotteryServerRpc } = await import("./server-rpc");

  const gate = await withLotteryServerRpc(async (connection) => {
    const programId = lotteryProgramId();
    const draw = await fetchDrawById(connection, programId, drawId);
    if (!draw) {
      return { skip: true as const, reason: "draw not found" };
    }
    const nowSec = await chainUnixTs(connection);
    if (!drawSalesHaveOpened(draw, nowSec)) {
      return { skip: true as const, reason: "sales not open yet" };
    }
    const seedLamports = await fetchJackpotLamports(connection, draw.prizeVault);
    return {
      skip: false as const,
      seedLamports,
      salesCloseTs: draw.salesCloseTs,
    };
  });

  if (gate.skip) {
    return { ok: false, skipped: true, reason: gate.reason };
  }

  const result = await announceDrawLiveChannels(drawId, {
    seedLamports: gate.seedLamports,
    salesCloseTs: gate.salesCloseTs,
  });

  if (result.ok) {
    return {
      ok: true,
      discordPosted: result.discordPosted,
      skipped: result.discordPosted === 0,
      reason: result.discordPosted === 0 ? "already posted" : undefined,
    };
  }

  return {
    ok: false,
    reason: result.reason,
    discordPosted: result.discordPosted,
  };
}
