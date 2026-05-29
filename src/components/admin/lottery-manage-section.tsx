"use client";

import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { useCallback, useEffect, useState } from "react";

import { adminFetchInProgressDrawAction } from "@/app/admin/(dashboard)/lotteries/actions";
import { LotteryCurrentDrawSpl } from "@/components/admin/lottery-current-draw-spl";
import { LotteryOpsPanel } from "@/components/admin/lottery-ops-panel";
import type { LotteryDrawView } from "@/lib/lottery/chain";
import { lotteryDrawViewFromJson } from "@/lib/lottery/draws";

/** Shows create-draw OR edit-current-draw — never both at once. */
export function LotteryManageSection() {
  const wallet = useAnchorWallet();

  const [liveDraw, setLiveDraw] = useState<LotteryDrawView | null>(null);
  const [drawLoading, setDrawLoading] = useState(true);

  const refreshLiveDraw = useCallback(async () => {
    if (!wallet) {
      setLiveDraw(null);
      setDrawLoading(false);
      return;
    }
    setDrawLoading(true);
    try {
      const json = await adminFetchInProgressDrawAction();
      setLiveDraw(json ? lotteryDrawViewFromJson(json) : null);
    } catch {
      setLiveDraw(null);
    } finally {
      setDrawLoading(false);
    }
  }, [wallet]);

  useEffect(() => {
    void refreshLiveDraw();
  }, [refreshLiveDraw]);

  return (
    <>
      <LotteryOpsPanel
        liveDraw={liveDraw}
        drawLoading={drawLoading}
        onLiveDrawChange={refreshLiveDraw}
      />
      {drawLoading ? (
        <p className="text-sm text-muted">Loading active draw…</p>
      ) : liveDraw ? (
        <LotteryCurrentDrawSpl draw={liveDraw} onDrawChange={refreshLiveDraw} />
      ) : null}
    </>
  );
}
