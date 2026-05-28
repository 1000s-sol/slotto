"use client";

import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { LotteryCurrentDrawSpl } from "@/components/admin/lottery-current-draw-spl";
import { LotteryOpsPanel } from "@/components/admin/lottery-ops-panel";
import type { LotteryDrawView } from "@/lib/lottery/chain";
import { lotteryProgramId } from "@/lib/lottery/config";
import { fetchInProgressDraw } from "@/lib/lottery/draws";

/** Shows create-draw OR edit-current-draw — never both at once. */
export function LotteryManageSection() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const programId = useMemo(() => lotteryProgramId(), []);

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
      const draw = await fetchInProgressDraw(connection, programId);
      setLiveDraw(draw);
    } catch {
      setLiveDraw(null);
    } finally {
      setDrawLoading(false);
    }
  }, [connection, programId, wallet]);

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
