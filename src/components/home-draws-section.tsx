"use client";

import { useConnection } from "@solana/wallet-adapter-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { fetchLotteryDraw } from "@/lib/lottery/chain";
import { lotteryProgramId, solscanAccountUrl } from "@/lib/lottery/config";
import { fetchDrawEntrants } from "@/lib/lottery/ticket-holders";

type TickerItem = {
  mint: string;
  symbol: string;
  priceUsd: number | null;
  logoUrl: string | null;
};

const SOL_MINT = "So11111111111111111111111111111111111111112";

type Entrant = {
  wallet: string;
  discord: string | null;
  x: string | null;
  tickets: number;
  paidWithMints: string[];
};

type PastDraw = {
  drawNumber: number;
  date: string;
  winnerWallet: string;
  discord: string | null;
  x: string | null;
  prizeSol: number;
  ticketsBought: number;
  totalTickets: number;
};

const PLACEHOLDER_PAST_DRAWS: PastDraw[] = [
  {
    drawNumber: 7,
    date: "Apr 2026",
    winnerWallet: "DegenApe88kCWaCKBpW39mZcKVj9fM5h3kQrL2N1XYz3a",
    discord: "degenape",
    x: "degenape_sol",
    prizeSol: 5.04,
    ticketsBought: 50,
    totalTickets: 1000,
  },
  {
    drawNumber: 6,
    date: "Mar 2026",
    winnerWallet: "Hk3UvD7sB6E1F8XdQ4Mw2RpNz5cKjLT9aY1B6PqMnVeS",
    discord: "thousands",
    x: "1000s_sol",
    prizeSol: 4.18,
    ticketsBought: 120,
    totalTickets: 920,
  },
  {
    drawNumber: 5,
    date: "Feb 2026",
    winnerWallet: "4Rp6jbqkWqA9mYxJrLfNd5sTeP3hVkA2nDXgM8KcBzUq",
    discord: null,
    x: null,
    prizeSol: 3.87,
    ticketsBought: 22,
    totalTickets: 845,
  },
  {
    drawNumber: 4,
    date: "Jan 2026",
    winnerWallet: "2cM1q9DhcVJyR3LzpfvP9aAqfPj4mPwQXmYbQ7nT8GxR",
    discord: "miloh",
    x: null,
    prizeSol: 6.21,
    ticketsBought: 78,
    totalTickets: 1170,
  },
  {
    drawNumber: 3,
    date: "Dec 2025",
    winnerWallet: "ZpQwL5sR3vB8YkJ2xH9nMcDfE7tA6gT4bN1uVeXqKp1F",
    discord: null,
    x: "monk3y",
    prizeSol: 2.95,
    ticketsBought: 11,
    totalTickets: 620,
  },
];

function shortenWallet(address: string) {
  if (address.length <= 10) return address;
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

function formatPct(n: number) {
  if (n >= 10) return `${n.toFixed(1)}%`;
  return `${n.toFixed(2)}%`;
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

function DiscordTag({ name }: { name: string | null }) {
  if (!name) return <span className="text-muted/40">—</span>;
  return <span className="text-foreground">{name}</span>;
}

function XTag({ name }: { name: string | null }) {
  if (!name) return <span className="text-muted/40">—</span>;
  return (
    <a
      href={`https://x.com/${name}`}
      target="_blank"
      rel="noopener noreferrer"
      className="text-accent-cyan hover:underline"
    >
      @{name}
    </a>
  );
}

function WalletCell({ address }: { address: string }) {
  return (
    <span title={address} className="font-mono text-xs text-foreground">
      {shortenWallet(address)}
    </span>
  );
}

type Tab = "current" | "past";

export function HomeDrawsSection() {
  const { connection } = useConnection();
  const programId = useMemo(() => lotteryProgramId(), []);
  const [tab, setTab] = useState<Tab>("current");
  const [tokens, setTokens] = useState<Record<string, TickerItem>>({});
  const [entrants, setEntrants] = useState<Entrant[]>([]);
  const [drawId, setDrawId] = useState<number | null>(null);
  const [drawAddress, setDrawAddress] = useState<string | null>(null);
  const [totalTickets, setTotalTickets] = useState(0);
  const [drawLoading, setDrawLoading] = useState(true);

  const refreshDraw = useCallback(async () => {
    const draw = await fetchLotteryDraw(connection, programId);
    if (!draw) {
      setDrawId(null);
      setDrawAddress(null);
      setTotalTickets(0);
      setEntrants([]);
      return;
    }
    setDrawId(draw.drawId);
    setDrawAddress(draw.draw.toBase58());
    setTotalTickets(draw.totalTickets);
    const holders = await fetchDrawEntrants(connection, programId, draw);
    setEntrants(
      holders.map((h) => ({
        wallet: h.wallet,
        discord: null,
        x: null,
        tickets: h.tickets,
        paidWithMints: [SOL_MINT],
      })),
    );
  }, [connection, programId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await refreshDraw();
      } finally {
        if (!cancelled) setDrawLoading(false);
      }
    })();
    const poll = setInterval(() => {
      refreshDraw().catch(() => undefined);
    }, 30_000);
    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, [refreshDraw]);

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
        /* fallback letters render */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const sortedEntrants = useMemo(
    () => [...entrants].sort((a, b) => b.tickets - a.tickets),
    [entrants],
  );

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="text-balance text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {tab === "current" ? "Current draw entrants" : "Past winners"}
        </h2>

        <div
          role="tablist"
          aria-label="Draw view"
          className="inline-flex rounded-xl border border-border bg-surface/40 p-1 text-xs font-semibold sm:text-sm"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === "current"}
            onClick={() => setTab("current")}
            className={`rounded-lg px-3 py-1.5 transition sm:px-4 sm:py-2 ${
              tab === "current"
                ? "bg-gradient-to-r from-accent-purple to-accent-blue text-white shadow-md shadow-accent-purple/25"
                : "text-muted hover:text-foreground"
            }`}
          >
            Current draw
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "past"}
            onClick={() => setTab("past")}
            className={`rounded-lg px-3 py-1.5 transition sm:px-4 sm:py-2 ${
              tab === "past"
                ? "bg-gradient-to-r from-accent-purple to-accent-blue text-white shadow-md shadow-accent-purple/25"
                : "text-muted hover:text-foreground"
            }`}
          >
            Past winners
          </button>
        </div>
      </div>

      {tab === "current" ? (
        drawLoading ? (
          <p className="text-sm text-muted">Loading entrants…</p>
        ) : drawId === null ? (
          <p className="rounded-2xl border border-border bg-bg-elevated/70 p-6 text-sm text-muted">
            No active draw on this network yet.
          </p>
        ) : (
          <CurrentDrawTable
            drawId={drawId}
            drawAddress={drawAddress}
            entrants={sortedEntrants}
            tokens={tokens}
            totalTickets={totalTickets}
          />
        )
      ) : (
        <PastWinnersTable draws={PLACEHOLDER_PAST_DRAWS} />
      )}
    </section>
  );
}

function CurrentDrawTable({
  drawId,
  drawAddress,
  entrants,
  tokens,
  totalTickets,
}: {
  drawId: number;
  drawAddress: string | null;
  entrants: Entrant[];
  tokens: Record<string, TickerItem>;
  totalTickets: number;
}) {

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-bg-elevated/70">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3 text-xs text-muted">
        <span>
          Draw #{drawId}
          {drawAddress ? (
            <>
              {" "}
              <a
                href={solscanAccountUrl(drawAddress)}
                className="font-mono text-accent-cyan hover:underline"
                target="_blank"
                rel="noreferrer"
              >
                {drawAddress.slice(0, 8)}…
              </a>
            </>
          ) : null}
          {" · "}
          <span className="text-foreground">
            {totalTickets.toLocaleString()}
          </span>{" "}
          tickets sold
        </span>
        <span className="font-mono">{entrants.length} entrants</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="text-[11px] uppercase tracking-wider text-muted/80">
            <tr className="border-b border-border">
              <th className="px-5 py-3 font-medium">#</th>
              <th className="px-3 py-3 font-medium">Wallet</th>
              <th className="px-3 py-3 font-medium">Discord</th>
              <th className="px-3 py-3 font-medium">X</th>
              <th className="px-3 py-3 text-right font-medium">Tickets</th>
              <th className="px-3 py-3 font-medium">Paid with</th>
              <th className="px-5 py-3 text-right font-medium">Win %</th>
            </tr>
          </thead>
          <tbody>
            {entrants.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-5 py-8 text-center text-sm text-muted"
                >
                  No tickets sold yet.
                </td>
              </tr>
            ) : (
              entrants.map((e, i) => {
              const chance = totalTickets > 0 ? (e.tickets / totalTickets) * 100 : 0;
              return (
                <tr
                  key={e.wallet}
                  className="border-b border-border/60 last:border-b-0 hover:bg-surface/30"
                >
                  <td className="px-5 py-3 text-xs font-semibold text-muted">
                    {i + 1}
                  </td>
                  <td className="px-3 py-3">
                    <WalletCell address={e.wallet} />
                  </td>
                  <td className="px-3 py-3 text-xs">
                    <DiscordTag name={e.discord} />
                  </td>
                  <td className="px-3 py-3 text-xs">
                    <XTag name={e.x} />
                  </td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums text-foreground">
                    {e.tickets}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1.5">
                      {e.paidWithMints.map((m) => (
                        <TokenThumb key={m} item={tokens[m]} />
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right font-mono tabular-nums text-accent-gold">
                    {formatPct(chance)}
                  </td>
                </tr>
              );
            })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PastWinnersTable({ draws }: { draws: PastDraw[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-bg-elevated/70">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="text-[11px] uppercase tracking-wider text-muted/80">
            <tr className="border-b border-border">
              <th className="px-5 py-3 font-medium">Draw</th>
              <th className="px-3 py-3 font-medium">Date</th>
              <th className="px-3 py-3 font-medium">Winner</th>
              <th className="px-3 py-3 font-medium">Discord</th>
              <th className="px-3 py-3 font-medium">X</th>
              <th className="px-3 py-3 text-right font-medium">Tickets</th>
              <th className="px-5 py-3 text-right font-medium">Won</th>
            </tr>
          </thead>
          <tbody>
            {draws.map((d) => (
              <tr
                key={d.drawNumber}
                className="border-b border-border/60 last:border-b-0 hover:bg-surface/30"
              >
                <td className="px-5 py-3 text-xs font-semibold text-muted">
                  #{d.drawNumber}
                </td>
                <td className="px-3 py-3 text-xs text-foreground">{d.date}</td>
                <td className="px-3 py-3">
                  <WalletCell address={d.winnerWallet} />
                </td>
                <td className="px-3 py-3 text-xs">
                  <DiscordTag name={d.discord} />
                </td>
                <td className="px-3 py-3 text-xs">
                  <XTag name={d.x} />
                </td>
                <td className="px-3 py-3 text-right font-mono tabular-nums text-muted">
                  <span className="text-foreground">{d.ticketsBought}</span>
                  <span className="text-muted/60">/{d.totalTickets}</span>
                </td>
                <td className="px-5 py-3 text-right font-mono tabular-nums text-accent-gold">
                  {d.prizeSol.toFixed(2)} SOL
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
