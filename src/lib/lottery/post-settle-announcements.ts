import type { Connection } from "@solana/web3.js";

import { announceDrawEnded } from "./announce-draw";
import { fetchDrawById } from "./chain";
import { lotteryProgramId } from "./config";
import { fetchSettledDrawPrizeLamports } from "./draws";

/** Best-effort X + Discord posts after a draw reaches Settled or Refunded. */
export async function postSettleAnnouncements(
  connection: Connection,
  drawId: number,
  opts: {
    finalState: string;
    winner: string | null;
  },
): Promise<void> {
  const refunded = opts.finalState === "Refunded";
  const terminal = opts.finalState === "Settled" || refunded;
  if (!terminal) return;

  const programId = lotteryProgramId();
  const dv = await fetchDrawById(connection, programId, drawId);
  const prizeLamports =
    dv && !refunded
      ? await fetchSettledDrawPrizeLamports(connection, dv)
      : undefined;

  await announceDrawEnded({
    drawId,
    winner: opts.winner,
    prizeLamports,
    totalTickets: dv?.totalTickets ?? 0,
    refunded,
  });

  if (!refunded && opts.winner) {
    const { notifyDiscordDrawWinner } = await import(
      "@/lib/discord-ticket-bot/post-draw-winner"
    );
    await notifyDiscordDrawWinner(connection, drawId);
  }
}
