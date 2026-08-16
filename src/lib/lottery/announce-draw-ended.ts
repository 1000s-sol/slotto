import type { Connection, PublicKey } from "@solana/web3.js";

import { fetchDrawById } from "./chain";
import { DrawState } from "./constants";
import { hasConfirmedDiscordDrawEmbed } from "./discord-draw-embed-idempotency";
import { globalConfigPda } from "./pdas";
import { createLotteryReadOnlyProgram } from "./program";

export type DrawEndedAnnounceResult = {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  posted?: number;
};

const RECENT_DRAW_WINDOW = 4;

/** Recently settled draws that still need a Discord winner embed. */
export async function fetchDrawIdsNeedingEndedAnnounce(
  connection: Connection,
  programId: PublicKey,
): Promise<number[]> {
  const program = createLotteryReadOnlyProgram(connection);
  const cfg = await program.account.globalConfig.fetch(
    globalConfigPda(programId),
  );
  const n = Number(cfg.nextDrawId);
  if (n <= 0) return [];

  const ids: number[] = [];
  const start = Math.max(0, n - RECENT_DRAW_WINDOW);
  for (let drawId = n - 1; drawId >= start; drawId -= 1) {
    const draw = await fetchDrawById(connection, programId, drawId);
    if (!draw || draw.state !== DrawState.Settled || !draw.winner) continue;
    if (await hasConfirmedDiscordDrawEmbed(drawId, "ended")) continue;
    ids.push(drawId);
  }
  return ids;
}

/** Post winner Discord (and X in production) for a settled draw. Idempotent. */
export async function runAnnounceDrawEndedIfNeeded(
  drawId: number,
): Promise<DrawEndedAnnounceResult> {
  const { lotteryProgramId } = await import("./config");
  const { withLotteryServerRpc } = await import("./server-rpc");
  const { postSettleAnnouncements } = await import("./post-settle-announcements");

  const gate = await withLotteryServerRpc(async (connection) => {
    const draw = await fetchDrawById(connection, lotteryProgramId(), drawId);
    if (!draw) return { skip: true as const, reason: "draw not found" };
    if (draw.state !== DrawState.Settled || !draw.winner) {
      return { skip: true as const, reason: "draw not settled" };
    }
    return { skip: false as const, winner: draw.winner };
  });

  if (gate.skip) {
    return { ok: true, skipped: true, reason: gate.reason };
  }

  try {
    await withLotteryServerRpc((connection) =>
      postSettleAnnouncements(connection, drawId, {
        finalState: "Settled",
        winner: gate.winner,
      }),
    );
    return { ok: true };
  } catch (e) {
    const reason = e instanceof Error ? e.message : "ended announce failed";
    console.warn("[lottery announce] ended retry failed:", reason);
    return { ok: false, reason };
  }
}
