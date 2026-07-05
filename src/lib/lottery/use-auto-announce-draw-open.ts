"use client";

import { useEffect, useRef } from "react";

import type { LotteryDrawView } from "./chain";
import { drawSalesHaveOpened } from "./draw-settlement";
import { triggerDrawOpenAnnounceAction } from "./trigger-draw-open-announce-action";

/**
 * When the sales-open countdown hits zero, post draw-live to Discord/X
 * (idempotent — safe if cron already posted).
 */
export function useAutoAnnounceDrawOpen(
  draw: LotteryDrawView | null,
  nowSec: number | null,
): void {
  const announcedRef = useRef<number | null>(null);

  useEffect(() => {
    if (!draw || nowSec === null) return;
    if (!drawSalesHaveOpened(draw, nowSec)) return;
    if (announcedRef.current === draw.drawId) return;

    announcedRef.current = draw.drawId;
    void triggerDrawOpenAnnounceAction(draw.drawId).catch((e) => {
      console.warn("[lottery] draw-open announce failed:", e);
      announcedRef.current = null;
    });
  }, [draw, draw?.drawId, draw?.salesOpenTs, draw?.state, nowSec]);
}
