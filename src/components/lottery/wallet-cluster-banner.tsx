"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useEffect, useState } from "react";

import {
  lotteryClusterMismatchMessage,
  walletMatchesLotteryCluster,
} from "@/lib/lottery/wallet-cluster";

export function WalletClusterBanner() {
  const { connection } = useConnection();
  const { connected } = useWallet();
  const [mismatch, setMismatch] = useState(false);

  useEffect(() => {
    if (!connected) {
      setMismatch(false);
      return;
    }
    let cancelled = false;
    void walletMatchesLotteryCluster(connection).then((ok) => {
      if (!cancelled) setMismatch(!ok);
    });
    return () => {
      cancelled = true;
    };
  }, [connection, connected]);

  if (!mismatch) return null;

  return (
    <p className="rounded-xl border border-amber-500/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">
      {lotteryClusterMismatchMessage()}
    </p>
  );
}
