"use server";

import { fetchDrawById, chainUnixTs } from "./chain";
import { lotteryProgramId } from "./config";
import { drawNeedsSettlement } from "./draw-settlement";
import { loadLotteryKeeperKeypair } from "./keeper-wallet";
import { allowUiSettlementCrank } from "./public-crank";
import { runTriggerLotteryCrank } from "./trigger-lottery-crank-impl";
import { withLotteryServerRpc } from "./server-rpc";
import { lotteryRpcErrorText } from "./user-facing-error";

export type CrankTriggerResult = {
  ok: boolean;
  error?: string;
  finalState?: string;
};

export type CrankUiResult = {
  ok: boolean;
  error?: string;
};

/** Server action: crank when the UI sees a draw awaiting settlement. */
export async function triggerLotteryCrank(
  drawId: number,
): Promise<CrankTriggerResult> {
  try {
    if (!Number.isFinite(drawId) || drawId < 0) {
      return { ok: false, error: "Invalid draw id" };
    }

    if (!allowUiSettlementCrank()) {
      return {
        ok: false,
        error:
          "UI settlement crank disabled — waiting on server cron. Refresh shortly.",
      };
    }

    if (!loadLotteryKeeperKeypair()) {
      return {
        ok: false,
        error:
          "Keeper not configured on Vercel (set LOTTERY_KEEPER_SECRET_KEY)",
      };
    }

    const needsCrank = await withLotteryServerRpc(async (connection) => {
      const draw = await fetchDrawById(
        connection,
        lotteryProgramId(),
        drawId,
      );
      if (!draw) return false;
      const nowSec = await chainUnixTs(connection);
      return drawNeedsSettlement(draw, nowSec);
    });

    if (!needsCrank) {
      try {
        const { DrawState } = await import("./constants");
        const { postSettleAnnouncements } = await import(
          "./post-settle-announcements"
        );
        await withLotteryServerRpc(async (connection) => {
          const draw = await fetchDrawById(
            connection,
            lotteryProgramId(),
            drawId,
          );
          if (
            !draw ||
            (draw.state !== DrawState.Settled &&
              draw.state !== DrawState.Refunded)
          ) {
            return;
          }
          await postSettleAnnouncements(connection, drawId, {
            finalState:
              draw.state === DrawState.Settled ? "Settled" : "Refunded",
            winner: draw.winner,
          });
        });
      } catch (e) {
        console.warn("[lottery crank] ended announce retry failed:", e);
      }
      return { ok: true };
    }

    return await runTriggerLotteryCrank(drawId);
  } catch (e) {
    return { ok: false, error: lotteryRpcErrorText(e) };
  }
}
