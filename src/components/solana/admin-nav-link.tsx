"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export function AdminNavLink({ className }: { className: string }) {
  const { connected, publicKey } = useWallet();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const address = publicKey?.toBase58();
    if (!connected || !address) {
      setIsAdmin(false);
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/admin/is-admin?address=${encodeURIComponent(address)}`, {
          cache: "no-store",
        });
        const json = (await res.json()) as { ok: boolean };
        if (cancelled) return;
        setIsAdmin(!!json.ok);
      } catch {
        if (cancelled) return;
        setIsAdmin(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [connected, publicKey]);

  if (!isAdmin) return null;
  return (
    <Link href="/admin" className={className}>
      Admin
    </Link>
  );
}
