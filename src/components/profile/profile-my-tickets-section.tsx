"use client";

import { useCallback, useEffect, useState } from "react";

import type { WalletDrawTickets } from "@/lib/lottery/wallet-tickets";
import { WRAPPED_SOL_MINT } from "@/lib/token-usd-prices";

type TickerItem = {
  mint: string;
  symbol: string;
  priceUsd: number | null;
  logoUrl: string | null;
};

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
  const [tokens, setTokens] = useState<Record<string, TickerItem>>({});
  const [wallets, setWallets] = useState<string[] | null>(null);
  const [rows, setRows] = useState<WalletDrawTickets[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshTickets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/profile/tickets", { cache: "no-store" });
      const json = (await res.json()) as {
        rows?: WalletDrawTickets[];
        wallets?: string[];
        error?: string;
      };
      setWallets(json.wallets ?? []);
      setRows(json.rows ?? []);
      if (!res.ok && json.error) setError(json.error);
    } catch {
      setRows([]);
      setError("Could not load tickets.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshTickets();
  }, [refreshTickets]);

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

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold tracking-tight text-foreground">
        My tickets
      </h2>

      {wallets === null || loading ? (
        <p className="text-sm text-muted">Loading your tickets…</p>
      ) : wallets.length === 0 ? (
        <p className="rounded-2xl border border-border bg-bg-elevated/70 p-6 text-sm text-muted">
          Link one or more wallets on your profile to see lottery tickets across all of
          them.
        </p>
      ) : error ? (
        <p className="rounded-2xl border border-border bg-bg-elevated/70 p-6 text-sm text-muted">
          {error}
        </p>
      ) : rows.length === 0 ? (
        <p className="rounded-2xl border border-border bg-bg-elevated/70 p-6 text-sm text-muted">
          No tickets on past public draws for your linked wallets.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-bg-elevated/70">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-muted/80">
                <tr className="border-b border-border">
                  <th className="px-5 py-3 font-medium">Draw</th>
                  <th className="px-3 py-3 font-medium">Date</th>
                  <th className="px-3 py-3 text-right font-medium">Tickets</th>
                  <th className="px-3 py-3 font-medium">Paid with</th>
                  <th className="px-5 py-3 text-right font-medium">Won</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.drawId}
                    className="border-b border-border/60 last:border-b-0 hover:bg-surface/30"
                  >
                    <td className="px-5 py-3 text-xs font-semibold text-foreground">
                      {r.displayLabel}
                    </td>
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
                        {(r.paidWithMints.length > 0
                          ? r.paidWithMints
                          : [WRAPPED_SOL_MINT]
                        ).map((mint) => (
                          <TokenThumb key={mint} item={tokens[mint]} />
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums">
                      {r.outcomeVariant === "live" || r.outcomeVariant === "won" ? (
                        <span className="text-accent-gold">{r.outcomeLabel}</span>
                      ) : r.outcomeVariant === "pending" ? (
                        <span className="text-amber-200/90">{r.outcomeLabel}</span>
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
      )}
    </section>
  );
}
