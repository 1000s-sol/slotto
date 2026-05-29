"use client";

import { useEffect, useState } from "react";

/** Phantom often flags *.vercel.app as a new domain — expected on preview deploys. */
export function ProductionDomainBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const host = window.location.hostname;
    setShow(host.endsWith(".vercel.app"));
  }, []);

  if (!show) return null;

  return (
    <p className="rounded-xl border border-amber-500/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">
      Preview URL (*.vercel.app): Phantom may show a &quot;new domain&quot; notice.
      That is normal here and does not mean the lottery tx is wrong — approve if the
      program and draw details match. Use the same preview URL for admin and buys so
      cluster env stays consistent.
    </p>
  );
}
