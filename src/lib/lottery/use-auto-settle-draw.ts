"use client";

import { useEffect, useRef } from "react";

import type { LotteryDrawView } from "./chain";
import { drawNeedsSettlement } from "./draw-settlement";
import { triggerLotteryCrank } from "./trigger-crank-action";
import { formatLotterySettlementError } from "./user-facing-error";

const CRANK_INTERVAL_MS = 4_000;

/**
 * While sales have ended (UI or on-chain), repeatedly crank until settled/refunded
 * and refresh chain state so the winner appears without manual settle.
 */
export function useAutoSettleDraw(
  draw: LotteryDrawView | null,
  nowSec: number | null,
  refresh: () => Promise<void>,
  onCrankError?: (message: string) => void,
): void {
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    if (!draw || !drawNeedsSettlement(draw, nowSec)) return;

    let cancelled = false;
    let cranking = false;

    const tick = async () => {
      if (cancelled || cranking) return;
      cranking = true;
      try {
        const result = await triggerLotteryCrank(draw.drawId);
        await refreshRef.current();
        if (!result.ok && result.error) {
          onCrankError?.(formatLotterySettlementError(result.error));
        }
      } finally {
        cranking = false;
      }
    };

    void tick();
    const id = setInterval(tick, CRANK_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [draw, draw?.drawId, draw?.state, draw?.salesCloseTs, nowSec, onCrankError]);
}
