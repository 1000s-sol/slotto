"use client";

import { useEffect, useRef } from "react";

import type { LotteryDrawView } from "./chain";
import { DrawState } from "./constants";
import { drawNeedsSettlement } from "./draw-settlement";
import {
  triggerLotteryCrank,
  type CrankUiResult,
} from "./trigger-crank-action";
import { formatLotterySettlementError } from "./user-facing-error";

/** Retry while close_sales / VRF runs (Switchboard often needs 2+ passes). */
const CRANK_INTERVAL_MS = 6_000;
/** Faster retries once VRF is requested (reveal + settle). */
const VRF_CRANK_INTERVAL_MS = 5_000;
/** After a failed server crank, slow down so the UI does not hammer RPC / actions. */
const CRANK_BACKOFF_MS = 30_000;

/**
 * When the countdown hits sales close, drive settlement via the server keeper
 * (no wallet popups). Throttled per draw on the server; GitHub cron is backup
 * when nobody has the page open.
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

    let cancelled = false;
    let cranking = false;
    let intervalMs = CRANK_INTERVAL_MS;
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
        const result = await triggerLotteryCrank(draw.drawId);
        await refreshRef.current();

        if (!result.ok && result.error) {
          intervalMs = CRANK_BACKOFF_MS;
          onCrankResultRef.current?.({
            ok: false,
            error: formatLotterySettlementError(result.error),
          });
        } else {
          intervalMs =
            draw.state === DrawState.VrfRequested
              ? VRF_CRANK_INTERVAL_MS
              : CRANK_INTERVAL_MS;
          if (result.ok) {
            onCrankResultRef.current?.({ ok: true });
          }
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
