import { lotteryProgramId } from "@/lib/lottery/config";
import { fetchDrawPaidWithMints } from "@/lib/lottery/draw-paid-with";
import {
  getDrawPaidWithCached,
  setDrawPaidWithCached,
} from "@/lib/lottery/draw-paid-with-cache";
import { getDrawPaidWithFromDb } from "@/lib/lottery/draw-paid-with-db";
import { withLotteryServerRpc } from "@/lib/lottery/server-rpc";

const inFlight = new Map<number, Promise<{ paidWith: Record<string, string[]>; complete: boolean }>>();

/** One chain scan per draw at a time — stops concurrent 504s from stampeding RPC. */
export async function fetchDrawPaidWithForApi(
  drawId: number,
): Promise<{ paidWith: Record<string, string[]>; complete: boolean }> {
  const cached = getDrawPaidWithCached(drawId);
  if (cached) return cached;

  try {
    const fromDb = await getDrawPaidWithFromDb(drawId);
    if (Object.keys(fromDb).length > 0) {
      setDrawPaidWithCached(drawId, fromDb, true);
      return { paidWith: fromDb, complete: true };
    }
  } catch {
    /* DB optional until migration/backfill */
  }

  const existing = inFlight.get(drawId);
  if (existing) return existing;

  const work = withLotteryServerRpc((connection) =>
    fetchDrawPaidWithMints(connection, lotteryProgramId(), drawId),
  )
    .then(({ paidWith, complete }) => {
      if (complete) {
        setDrawPaidWithCached(drawId, paidWith, complete);
      }
      return { paidWith, complete };
    })
    .finally(() => {
      inFlight.delete(drawId);
    });

  inFlight.set(drawId, work);
  return work;
}
