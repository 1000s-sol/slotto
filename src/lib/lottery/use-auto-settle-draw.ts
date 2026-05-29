"use client";

import { useConnection } from "@solana/wallet-adapter-react";
import { useEffect, useRef } from "react";

import type { LotteryDrawView } from "./chain";
import { lotteryProgramId } from "./config";
import { crankEmptyDrawWithWallet } from "./crank-empty-draw";
import { drawNeedsSettlement } from "./draw-settlement";
import {
  triggerLotteryCrank,
  type CrankUiResult,
} from "./trigger-crank-action";
import { formatLotterySettlementError } from "./user-facing-error";
import { useLotteryWallet } from "./use-lottery-wallet";

const CRANK_INTERVAL_MS = 4_000;

/**
 * While sales have ended (UI or on-chain), repeatedly crank until settled/refunded
 * and refresh chain state so the winner appears without manual settle.
 */
export function useAutoSettleDraw(
  draw: LotteryDrawView | null,
  nowSec: number | null,
  refresh: () => Promise<void>,
  onCrankResult?: (result: CrankUiResult) => void,
): void {
  const { connection } = useConnection();
  const wallet = useLotteryWallet();
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
        if (draw.totalTickets === 0 && wallet) {
          await crankEmptyDrawWithWallet(
            connection,
            wallet,
            lotteryProgramId(),
            draw.drawId,
          );
          await refreshRef.current();
          onCrankResult?.({ ok: true });
          return;
        }

        const result = await triggerLotteryCrank(draw.drawId);
        await refreshRef.current();
        if (!result.ok && result.error) {
          onCrankResult?.({
            ok: false,
            error: formatLotterySettlementError(result.error),
          });
        } else if (result.ok) {
          onCrankResult?.({ ok: true });
        }
      } catch (e) {
        await refreshRef.current();
        onCrankResult?.({
          ok: false,
          error: formatLotterySettlementError(e),
        });
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
  }, [
    connection,
    draw,
    draw?.drawId,
    draw?.state,
    draw?.salesCloseTs,
    draw?.totalTickets,
    nowSec,
    onCrankResult,
    wallet,
  ]);
}
