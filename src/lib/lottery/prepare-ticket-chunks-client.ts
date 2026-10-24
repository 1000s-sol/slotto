import { ensureTicketChunksForPurchaseAction } from "@/app/admin/(dashboard)/lotteries/draw-infrastructure-actions";

import { purchaseNeedsChunkInit } from "./ticket-chunks";

const CHUNK_PREP_MS = 8_000;

/**
 * Fund later ticket-chunk accounts before a buy. Chunk 0 already exists from
 * create_draw, so most purchases skip this. If the server RPC stalls, open the
 * wallet anyway — the buy transaction fails clearly if a chunk is missing.
 */
export async function prepareTicketChunksForBuy(
  drawId: number,
  totalTickets: number,
  count: number,
): Promise<{ ok: true; inited: number } | { ok: false; error: string }> {
  if (!purchaseNeedsChunkInit(totalTickets, count)) {
    return { ok: true, inited: 0 };
  }

  const prep = ensureTicketChunksForPurchaseAction(drawId, count);
  const timeout = new Promise<{ ok: true; inited: 0 }>((resolve) => {
    setTimeout(() => resolve({ ok: true, inited: 0 }), CHUNK_PREP_MS);
  });
  return Promise.race([prep, timeout]);
}
