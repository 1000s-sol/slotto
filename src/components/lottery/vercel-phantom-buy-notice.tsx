"use client";

import { useEffect, useState } from "react";

import { lotteryProgramId } from "@/lib/lottery/config";

const CANONICAL_ORIGIN =
  process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://slotto.gg";

/**
 * Phantom Blowfish often blocks or mis-simulates txs on *.vercel.app preview hosts.
 * Show one factual notice on the buy section only.
 */
export function VercelPhantomBuyNotice() {
  const [show, setShow] = useState(false);
  const programShort = lotteryProgramId().toBase58().slice(0, 8);

  useEffect(() => {
    setShow(window.location.hostname.endsWith(".vercel.app"));
  }, []);

  if (!show) return null;

  return (
    <div className="mt-4 rounded-xl border border-red-500/60 bg-red-950/40 px-4 py-3 text-sm text-red-100">
      <p className="font-semibold text-red-50">
        Phantom blocks many preview URLs — not a missing-SOL problem
      </p>
      <p className="mt-2 text-red-100/90">
        On <span className="font-mono">*.vercel.app</span>, Phantom may show
        &quot;Request blocked&quot;, &quot;malicious dApp&quot;, or &quot;not enough
        SOL&quot; even when this page shows your mainnet balance. The ticket only
        costs ~0.0105 SOL; your balance above is read from mainnet Helius.
      </p>
      <p className="mt-2 text-red-100/90">
        Use{" "}
        <a
          href={CANONICAL_ORIGIN}
          className="font-semibold text-red-50 underline"
        >
          {CANONICAL_ORIGIN.replace(/^https:\/\//, "")}
        </a>{" "}
        for buys if it is live, or in Phantom click{" "}
        <span className="font-semibold">Proceed anyway (unsafe)</span> and confirm
        program <span className="font-mono">{programShort}…</span> matches.
      </p>
    </div>
  );
}
