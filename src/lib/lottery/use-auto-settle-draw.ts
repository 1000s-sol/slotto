"use client";

import { useEffect, useRef } from "react";

import type { LotteryDrawView } from "./chain";
import { DrawState } from "./constants";
import { drawNeedsSettlement, drawTerminalState } from "./draw-settlement";
import {
  triggerLotteryCrank,
  type CrankUiResult,
} from "./trigger-crank-action";
import { formatLotterySettlementError } from "./user-facing-error";

/** Aggressive retries once sales close time passes (Switchboard needs 2+ passes). */
const SETTLE_INTERVAL_MS = 4_000;
const VRF_SETTLE_INTERVAL_MS = 5_000;
const CRANK_BACKOFF_MS = 12_000;

/**
 * When the countdown hits zero, drive settlement via the server keeper until
 * the draw reaches Settled or Refunded (no wallet popups).
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
  const drawRef = useRef(draw);
  drawRef.current = draw;
  const nowSecRef = useRef(nowSec);
  nowSecRef.current = nowSec;

  useEffect(() => {
    if (!draw || !drawNeedsSettlement(draw, nowSec)) return;

    let cancelled = false;
    let cranking = false;
    let intervalMs = SETTLE_INTERVAL_MS;
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
      const current = drawRef.current;
      if (!current || drawTerminalState(current)) {
        return;
      }
      if (!drawNeedsSettlement(current, nowSecRef.current)) {
        return;
      }

      cranking = true;
      try {
        const result = await triggerLotteryCrank(current.drawId);
        await refreshRef.current();

        const refreshed = drawRef.current;
        if (refreshed && drawTerminalState(refreshed)) {
          onCrankResultRef.current?.({ ok: true });
          return;
        }

        if (!result.ok && result.error) {
          intervalMs = CRANK_BACKOFF_MS;
          onCrankResultRef.current?.({
            ok: false,
            error: formatLotterySettlementError(result.error),
          });
        } else {
          intervalMs =
            refreshed?.state === DrawState.VrfRequested
              ? VRF_SETTLE_INTERVAL_MS
              : SETTLE_INTERVAL_MS;
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
        if (!cancelled && drawRef.current && !drawTerminalState(drawRef.current)) {
          schedule(intervalMs);
        }
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
