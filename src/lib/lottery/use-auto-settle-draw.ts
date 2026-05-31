"use client";

import { useEffect, useRef } from "react";

import type { LotteryDrawView } from "./chain";
import { drawNeedsSettlement } from "./draw-settlement";
import {
  triggerLotteryCrank,
  type CrankUiResult,
} from "./trigger-crank-action";
import { formatLotterySettlementError } from "./user-facing-error";

const CRANK_INTERVAL_MS = 8_000;
/** Poll chain state when settlement is cron-only (no public keeper action). */
const REFRESH_ONLY_MS = 12_000;
/** After a failed server crank, slow down so the UI does not hammer RPC / actions. */
const CRANK_BACKOFF_MS = 45_000;

/** Opt-in: set `NEXT_PUBLIC_LOTTERY_PUBLIC_CRANK_ENABLED=true` to allow visitor-triggered crank. */
function visitorCrankEnabled(): boolean {
  return process.env.NEXT_PUBLIC_LOTTERY_PUBLIC_CRANK_ENABLED === "true";
}

/**
 * After sales end, crank via the server keeper only (no wallet popups).
 * Empty-draw refunds use the same keeper path (no visitor wallet txs).
 */
export function useAutoSettleDraw(
  draw: LotteryDrawView | null,
  nowSec: number | null,
  refresh: () => Promise<void>,
  onCrankResult?: (result: CrankUiResult) => void,
): void {
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const onCrankResultRef = useRef(onCrankResult);
  onCrankResultRef.current = onCrankResult;

  useEffect(() => {
    if (!draw || !drawNeedsSettlement(draw, nowSec)) return;

    const useVisitorCrank = visitorCrankEnabled();
    let cancelled = false;
    let cranking = false;
    let intervalMs = useVisitorCrank ? CRANK_INTERVAL_MS : REFRESH_ONLY_MS;
    let timerId: ReturnType<typeof setTimeout> | null = null;

    const schedule = (ms: number) => {
      if (cancelled) return;
      if (timerId) clearTimeout(timerId);
      timerId = setTimeout(() => {
        void tick();
      }, ms);
    };

    const tick = async () => {
      if (cancelled || cranking) return;
      cranking = true;
      try {
        if (!useVisitorCrank) {
          await refreshRef.current();
          intervalMs = REFRESH_ONLY_MS;
          return;
        }
        const result = await triggerLotteryCrank(draw.drawId);
        await refreshRef.current();
        if (!result.ok && result.error) {
          intervalMs = CRANK_BACKOFF_MS;
          onCrankResultRef.current?.({
            ok: false,
            error: formatLotterySettlementError(result.error),
          });
        } else if (result.ok) {
          intervalMs = CRANK_INTERVAL_MS;
          onCrankResultRef.current?.({ ok: true });
        }
      } catch (e) {
        intervalMs = CRANK_BACKOFF_MS;
        await refreshRef.current();
        onCrankResultRef.current?.({
          ok: false,
          error: formatLotterySettlementError(e),
        });
      } finally {
        cranking = false;
        schedule(intervalMs);
      }
    };

    void tick();
    return () => {
      cancelled = true;
      if (timerId) clearTimeout(timerId);
    };
  }, [
    draw,
    draw?.drawId,
    draw?.state,
    draw?.salesCloseTs,
    draw?.totalTickets,
    nowSec,
  ]);
}
