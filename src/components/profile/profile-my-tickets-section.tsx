"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useEffect, useState } from "react";

type TickerItem = {
  mint: string;
  symbol: string;
  priceUsd: number | null;
  logoUrl: string | null;
};

type MyTicketRow = {
  drawNumber: number;
  dateLabel: string;
  isLive: boolean;
  yourTickets: number;
  poolTickets: number;
  paidWithMints: string[];
  outcomeLabel: string;
  outcomeVariant: "live" | "won" | "lost";
};

const SOL_MINT = "So11111111111111111111111111111111111111112";
const PLACEHOLDER_MINTS = {
  SOL: SOL_MINT,
  CJT: "7ztGsbEkbSzeeUgm3SwCp6hkmaJe3Gwi4zgvANKSfYML",
  BLUNANA: "C9vfeaCLhJy7sykgKnfzi6RikawQNoGtRKwsaupKavmV",
  EMPIRE: "EmpirdtfUMfBQXEjnNmTngeimjfizfuSBD3TN9zqzydj",
} as const;

/** Placeholder rows until ticket purchases are wired to the database */
const PLACEHOLDER_MY_TICKETS: MyTicketRow[] = [
  {
    drawNumber: 8,
    dateLabel: "Live",
    isLive: true,
    yourTickets: 42,
    poolTickets: 612,
    paidWithMints: [PLACEHOLDER_MINTS.SOL, PLACEHOLDER_MINTS.CJT],
    outcomeLabel: "6.86%",
    outcomeVariant: "live",
  },
  {
    drawNumber: 7,
    dateLabel: "Apr 2026",
    isLive: false,
    yourTickets: 24,
    poolTickets: 1000,
    paidWithMints: [PLACEHOLDER_MINTS.SOL, PLACEHOLDER_MINTS.EMPIRE],
    outcomeLabel: "—",
    outcomeVariant: "lost",
  },
  {
    drawNumber: 5,
    dateLabel: "Feb 2026",
    isLive: false,
    yourTickets: 60,
    poolTickets: 845,
    paidWithMints: [PLACEHOLDER_MINTS.BLUNANA],
    outcomeLabel: "4.20 SOL",
    outcomeVariant: "won",
  },
  {
    drawNumber: 3,
    dateLabel: "Dec 2025",
    isLive: false,
    yourTickets: 8,
    poolTickets: 620,
    paidWithMints: [PLACEHOLDER_MINTS.SOL],
    outcomeLabel: "—",
    outcomeVariant: "lost",
  },
];

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
  const { publicKey } = useWallet();
  const wallet = publicKey?.toBase58() ?? null;

  const [tokens, setTokens] = useState<Record<string, TickerItem>>({});

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
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-foreground">My tickets</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Your purchases across the live draw and completed draws
          {wallet ? (
            <>
              {" "}
              for wallet{" "}
              <span className="font-mono text-xs text-foreground/90" title={wallet}>
                {shortenWallet(wallet)}
              </span>
            </>
          ) : null}
          . <span className="text-muted/80">Placeholder data for now.</span>
        </p>
      </div>

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
              {PLACEHOLDER_MY_TICKETS.map((r) => (
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
    </section>
  );
}
