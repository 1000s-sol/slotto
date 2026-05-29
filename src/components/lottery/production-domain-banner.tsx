"use client";

import { useEffect, useState } from "react";

/** Wallet txs on *.vercel.app get Phantom "new domain" + higher Blowfish risk scores. */
export function ProductionDomainBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const host = window.location.hostname;
    setShow(host.endsWith(".vercel.app"));
  }, []);

  if (!show) return null;

  return (
    <p className="rounded-xl border border-red-500/50 bg-red-950/40 px-4 py-3 text-sm text-red-100">
      You are on a Vercel preview URL. For wallet transactions use{" "}
      <a
        href="https://slotto.gg"
        className="font-semibold text-white underline"
      >
        slotto.gg
      </a>{" "}
      — Phantom treats preview domains as new/untrusted and shows stronger
      security warnings.
    </p>
  );
}
