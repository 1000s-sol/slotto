"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { solscanAccountUrl } from "@/lib/lottery/config";
import { drawNeedsSettlement } from "@/lib/lottery/draw-settlement";
import {
  formatDrawDateLabel,
  lotteryDrawViewFromJson,
} from "@/lib/lottery/draws";
import { fetchLotteryStateClient } from "@/lib/lottery/fetch-lottery-state-client";
import { fetchPastWinnersClient } from "@/lib/lottery/fetch-past-winners-client";
import type { LotteryDrawView } from "@/lib/lottery/chain";
import { fetchDrawEntrantsClient } from "@/lib/lottery/fetch-draw-entrants-client";
import { DiscordLogo } from "@/components/discord-logo";
import { SocialProfileCell } from "@/components/social-profile-cell";
import { fetchWalletSocialsClient } from "@/lib/fetch-wallet-social-client";
import type { SocialProfile } from "@/lib/social-profile-url";

type TokenMeta = {
  mint: string;
  symbol: string;
  name?: string;
  imageUrl: string | null;
};

const SOL_MINT = "So11111111111111111111111111111111111111112";

type Entrant = {
  wallet: string;
  discord: SocialProfile | null;
  x: SocialProfile | null;
  tickets: number;
};

type PastDraw = {
  drawNumber: number;
  date: string;
  winnerWallet: string;
  discord: SocialProfile | null;
  x: SocialProfile | null;
  prizeSol: number;
  ticketsBought: number;
  totalTickets: number;
};

function shortenWallet(address: string) {
  if (address.length <= 10) return address;
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

function formatPct(n: number) {
  if (n >= 10) return `${n.toFixed(1)}%`;
  return `${n.toFixed(2)}%`;
}

function TokenThumb({ item, size = 18 }: { item: TokenMeta | undefined; size?: number }) {
  const [failed, setFailed] = useState(false);
  const dim = `${size}px`;
  const cls = "shrink-0 rounded-full object-cover ring-1 ring-border";
  if (item?.imageUrl && !failed) {
    return (
      <img
        src={item.imageUrl}
        alt={item.symbol}
        title={item.symbol}
        className={cls}
        style={{ width: dim, height: dim }}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
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

function WalletCell({ address }: { address: string }) {
  return (
    <span title={address} className="font-mono text-xs text-foreground">
      {shortenWallet(address)}
    </span>
  );
}

type Tab = "current" | "past";

export function HomeDrawsSection() {
  const [tab, setTab] = useState<Tab>("current");
  const [tokens, setTokens] = useState<Record<string, TokenMeta>>({});
  const [paidWith, setPaidWith] = useState<Record<string, string[]>>({});
  const [entrants, setEntrants] = useState<Entrant[]>([]);
  const [drawId, setDrawId] = useState<number | null>(null);
  const [drawAddress, setDrawAddress] = useState<string | null>(null);
  const [totalTickets, setTotalTickets] = useState(0);
  const [drawState, setDrawState] = useState<number | null>(null);
  const [drawLoading, setDrawLoading] = useState(true);
  const [pastDraws, setPastDraws] = useState<PastDraw[]>([]);
  const [pastLoading, setPastLoading] = useState(true);
  const [inProgressDraw, setInProgressDraw] = useState<LotteryDrawView | null>(
    null,
  );
  const [nowSec, setNowSec] = useState<number | null>(null);

  const refreshDraw = useCallback(async () => {
    try {
      const state = await fetchLotteryStateClient();
      setNowSec(state.nowSec);
      const draw = state.activeDraw
        ? lotteryDrawViewFromJson(state.activeDraw)
        : null;
      setInProgressDraw(draw);
      if (!draw) {
        setDrawId(null);
        setDrawAddress(null);
        setTotalTickets(0);
        setDrawState(null);
        setEntrants([]);
        return;
      }
      setDrawId(draw.drawId);
      setDrawAddress(draw.draw.toBase58());
      setTotalTickets(draw.totalTickets);
      setDrawState(draw.state);
      const holders = await fetchDrawEntrantsClient(draw.drawId);
      const socials = await fetchWalletSocialsClient(
        holders.map((h) => h.wallet),
      );
      setEntrants(
        holders.map((h) => {
          const s = socials[h.wallet];
          return {
            wallet: h.wallet,
            discord: s?.discord ?? null,
            x: s?.x ?? null,
            tickets: h.tickets,
          };
        }),
      );
    } catch {
      setInProgressDraw(null);
      setEntrants([]);
    }
  }, []);

  const needsSettlement = Boolean(
    inProgressDraw && drawNeedsSettlement(inProgressDraw, nowSec),
  );

  useEffect(() => {
    const tick = setInterval(() => {
      setNowSec((s) => (s !== null ? s + 1 : s));
    }, 1000);
    return () => clearInterval(tick);
  }, []);

  const refreshPast = useCallback(async () => {
    try {
      const settled = await fetchPastWinnersClient();
      const rows: PastDraw[] = [];
      for (const draw of settled) {
        let ticketsBought = 0;
        try {
          const holders = await fetchDrawEntrantsClient(draw.drawId);
          ticketsBought =
            holders.find((h) => h.wallet === draw.winner)?.tickets ?? 0;
        } catch {
          // Entrants are optional for past winners; winner wallet is on-chain.
        }
        const socials = await fetchWalletSocialsClient([draw.winner]);
        const winnerSocial = socials[draw.winner];
        rows.push({
          drawNumber: draw.drawId,
          date: formatDrawDateLabel(draw.salesCloseTs),
          winnerWallet: draw.winner,
          discord: winnerSocial?.discord ?? null,
          x: winnerSocial?.x ?? null,
          prizeSol: draw.prizeLamports / 1_000_000_000,
          ticketsBought,
          totalTickets: draw.totalTickets,
        });
      }
      setPastDraws(rows);
    } catch {
      setPastDraws([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await refreshDraw();
      } finally {
        if (!cancelled) setDrawLoading(false);
      }
    })();
    const pollMs = needsSettlement ? 4_000 : 30_000;
    const poll = setInterval(() => {
      refreshDraw().catch(() => undefined);
    }, pollMs);
    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, [refreshDraw, needsSettlement]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await refreshPast();
      } finally {
        if (!cancelled) setPastLoading(false);
      }
    })();
    const poll = setInterval(() => {
      refreshPast().catch(() => undefined);
    }, 60_000);
    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, [refreshPast]);

  useEffect(() => {
    if (drawId === null) {
      setTokens({});
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/lottery/draw-tokens?drawId=${drawId}`, {
          cache: "no-store",
        });
        const json = (await res.json()) as {
          tokens?: Record<string, TokenMeta>;
        };
        if (cancelled || !json.tokens) return;
        setTokens(json.tokens);
      } catch {
        /* fallback letters render */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [drawId]);

  useEffect(() => {
    if (drawId === null || totalTickets === 0) {
      setPaidWith({});
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(
          `/api/lottery/draw-paid-with?drawId=${drawId}`,
          { cache: "no-store" },
        );
        const json = (await res.json()) as {
          paidWith?: Record<string, string[]>;
        };
        if (cancelled || !json.paidWith) return;
        setPaidWith(json.paidWith);
      } catch {
        /* fallback to SOL thumbnail */
      }
    };
    void load();
    const poll = setInterval(() => void load(), 30_000);
    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, [drawId, totalTickets]);

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
            No active draw. The next round will be announced on X.
          </p>
        ) : (
          <CurrentDrawTable
            drawId={drawId}
            drawAddress={drawAddress}
            drawState={drawState}
            settling={needsSettlement}
            entrants={sortedEntrants}
            tokens={tokens}
            paidWith={paidWith}
            totalTickets={totalTickets}
          />
        )
      ) : pastLoading ? (
        <p className="text-sm text-muted">Loading past winners…</p>
      ) : pastDraws.length === 0 ? (
        <p className="rounded-2xl border border-border bg-bg-elevated/70 p-6 text-sm text-muted">
          No settled draws yet.
        </p>
      ) : (
        <PastWinnersTable draws={pastDraws} />
      )}
    </section>
  );
}

function CurrentDrawTable({
  drawId,
  drawAddress,
  drawState,
  settling,
  entrants,
  tokens,
  paidWith,
  totalTickets,
}: {
  drawId: number;
  drawAddress: string | null;
  drawState: number | null;
  settling: boolean;
  entrants: Entrant[];
  tokens: Record<string, TokenMeta>;
  paidWith: Record<string, string[]>;
  totalTickets: number;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-bg-elevated/70">
      {settling ? (
        <div className="border-b border-amber-500/30 bg-amber-950/20 px-5 py-3 text-sm text-amber-100">
          Drawing winner and sending prize…
        </div>
      ) : null}
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
              <th className="px-3 py-3 font-medium">
                <span className="sr-only">Discord</span>
                <DiscordLogo size={18} />
              </th>
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
                  {totalTickets > 0
                    ? "Loading entrant details…"
                    : "No tickets sold yet."}
                </td>
              </tr>
            ) : (
              entrants.map((e, i) => {
                const chance =
                  totalTickets > 0 ? (e.tickets / totalTickets) * 100 : 0;
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
                      <SocialProfileCell profile={e.discord} platform="discord" />
                    </td>
                    <td className="px-3 py-3 text-xs">
                      <SocialProfileCell profile={e.x} platform="x" />
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums text-foreground">
                      {e.tickets}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1.5">
                        {(paidWith[e.wallet] ?? [SOL_MINT]).map((m) => (
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
              <th className="px-3 py-3 font-medium">
                <span className="sr-only">Discord</span>
                <DiscordLogo size={18} />
              </th>
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
                  <SocialProfileCell profile={d.discord} platform="discord" />
                </td>
                <td className="px-3 py-3 text-xs">
                  <SocialProfileCell profile={d.x} platform="x" />
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
