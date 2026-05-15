"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useEffect, useMemo, useState } from "react";

import type { MyTicketRow } from "@/lib/lottery-my-tickets-types";

type TickerItem = {
  mint: string;
  symbol: string;
  priceUsd: number | null;
  logoUrl: string | null;
};

function shortenWallet(address: string) {
  if (address.length <= 10) return address;
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

function TokenThumb({ item, size = 18 }: { item: TickerItem | undefined; size?: number }) {
  const dim = `${size}px`;
  const cls = "shrink-0 rounded-full object-cover ring-1 ring-border";
  if (item?.logoUrl) {
    return (
      <img
        src={item.logoUrl}
        alt={item.symbol}
        title={item.symbol}
        className={cls}
        style={{ width: dim, height: dim }}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
      />
    );
  }
  const initial = (item?.symbol || "?")
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(0, 1)
    .toUpperCase() || "?";
  return (
    <span
      className={`${cls} inline-flex items-center justify-center bg-surface text-[9px] font-bold text-muted`}
      style={{ width: dim, height: dim }}
      aria-hidden
      title={item?.symbol}
    >
      {initial}
    </span>
  );
}

export function ProfileMyTicketsSection() {
  const { publicKey, connected } = useWallet();
  const wallet = publicKey?.toBase58() ?? null;

  const [tokens, setTokens] = useState<Record<string, TickerItem>>({});
  const [rows, setRows] = useState<MyTicketRow[] | null>(null);
  const [anyDraws, setAnyDraws] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/ticker-prices", { cache: "no-store" });
        const json = (await res.json()) as { items?: TickerItem[] };
        if (cancelled || !json.items) return;
        const map: Record<string, TickerItem> = {};
        for (const it of json.items) map[it.mint] = it;
        setTokens(map);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!wallet) {
      setRows(null);
      setAnyDraws(false);
      setLoadError(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setRows(null);
      setLoadError(null);
      try {
        const res = await fetch(`/api/profile/my-tickets?wallet=${encodeURIComponent(wallet)}`, {
          cache: "no-store",
        });
        const json = (await res.json()) as {
          rows?: MyTicketRow[];
          anyDraws?: boolean;
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok) {
          setLoadError(json.error ?? "Could not load tickets");
          setRows([]);
          return;
        }
        setRows(json.rows ?? []);
        setAnyDraws(!!json.anyDraws);
      } catch {
        if (!cancelled) {
          setLoadError("Could not load tickets");
          setRows([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [wallet]);

  const body = useMemo(() => {
    if (!connected) {
      return (
        <p className="text-sm text-muted">
          Connect your wallet to see ticket purchases for the current draw and completed draws.
        </p>
      );
    }
    if (loadError) {
      return <p className="text-sm text-red-300">{loadError}</p>;
    }
    if (rows === null) {
      return <div className="h-24 animate-pulse rounded-xl bg-surface/40" aria-hidden />;
    }
    if (!anyDraws) {
      return <p className="text-sm text-muted">No lottery draws on record yet. Purchases will show here.</p>;
    }
    if (rows.length === 0) {
      return (
        <p className="text-sm text-muted">
          You have no ticket purchases on record. The live draw appears here once you buy tickets.
        </p>
      );
    }
    return (
      <div className="overflow-hidden rounded-2xl border border-border bg-bg-elevated/70">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="text-[11px] uppercase tracking-wider text-muted/80">
              <tr className="border-b border-border">
                <th className="px-5 py-3 font-medium">Draw</th>
                <th className="px-3 py-3 font-medium">Date</th>
                <th className="px-3 py-3 text-right font-medium">Tickets</th>
                <th className="px-3 py-3 font-medium">Paid with</th>
                <th className="px-5 py-3 text-right font-medium">Win % / won</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                  <tr
                    key={`${r.drawNumber}-${r.isLive ? "live" : "done"}`}
                    className="border-b border-border/60 last:border-b-0 hover:bg-surface/30"
                  >
                    <td className="px-5 py-3 text-xs font-semibold text-muted">#{r.drawNumber}</td>
                    <td className="px-3 py-3 text-xs text-foreground">
                      {r.isLive ? (
                        <span className="rounded-md bg-emerald-950/50 px-2 py-0.5 font-medium text-emerald-200">
                          Live
                        </span>
                      ) : (
                        r.dateLabel
                      )}
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums text-muted">
                      <span className="text-foreground">{r.yourTickets}</span>
                      <span className="text-muted/60">/{r.poolTickets}</span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1.5">
                        {r.paidWithMints.length > 0 ? (
                          r.paidWithMints.map((m) => <TokenThumb key={m} item={tokens[m]} />)
                        ) : (
                          <span className="text-muted/40">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums">
                      {r.outcomeVariant === "live" ? (
                        <span className="text-accent-gold">{r.outcomeLabel}</span>
                      ) : r.outcomeVariant === "won" ? (
                        <span className="text-accent-gold">{r.outcomeLabel}</span>
                      ) : (
                        <span className="text-muted">{r.outcomeLabel}</span>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }, [anyDraws, connected, loadError, rows, tokens]);

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-foreground">My tickets</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Your purchases across the live draw and completed draws for wallet{" "}
          {wallet ? (
            <span className="font-mono text-xs text-foreground/90" title={wallet}>
              {shortenWallet(wallet)}
            </span>
          ) : (
            "—"
          )}
          .
        </p>
      </div>
      {body}
    </section>
  );
}
