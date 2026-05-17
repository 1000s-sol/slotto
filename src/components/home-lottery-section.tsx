"use client";

import { useAnchorWallet, useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useCallback, useEffect, useMemo, useState } from "react";

import { buySolTickets } from "@/lib/lottery/buy-sol-tickets";
import {
  chainUnixTs,
  fetchJackpotLamports,
  fetchLotteryDraw,
  isDrawBuyable,
  type LotteryDrawView,
  type SplMintRowView,
} from "@/lib/lottery/chain";
import {
  DrawState,
  LAMPORTS_PER_SOL_TICKET,
  LAMPORTS_SOL_TICKET_FEE,
  LAMPORTS_SOL_TICKET_PRICE,
  MAX_SOL_TICKETS_PER_BUY,
} from "@/lib/lottery/constants";
import {
  lotteryProgramId,
  solscanAccountUrl,
  solscanTxUrl,
} from "@/lib/lottery/config";

type Phase =
  | { kind: "idle" }
  | { kind: "busy"; label: string }
  | { kind: "ok"; message: string; signature: string }
  | { kind: "error"; message: string };

function formatSolFromLamports(lamports: number): string {
  return (lamports / LAMPORTS_PER_SOL).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}

function splitCountdown(totalSec: number): [number, number, number, number] {
  const s = Math.max(0, Math.floor(totalSec));
  return [
    Math.floor(s / 86400),
    Math.floor((s % 86400) / 3600),
    Math.floor((s % 3600) / 60),
    s % 60,
  ];
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function drawStateLabel(state: number): string {
  switch (state) {
    case DrawState.Selling:
      return "Tickets on sale";
    case DrawState.SalesClosed:
      return "Sales closed";
    case DrawState.VrfRequested:
      return "Drawing winner";
    case DrawState.Settled:
      return "Settled";
    case DrawState.Refunded:
      return "Refunded";
    default:
      return "Unknown";
  }
}

function buyDisabledReason(
  draw: LotteryDrawView,
  nowSec: number | null,
  connected: boolean,
): string | null {
  if (!connected) return "Connect your wallet to buy tickets.";
  if (nowSec === null) return "Loading chain time…";
  if (draw.state !== DrawState.Selling) return drawStateLabel(draw.state);
  if (nowSec < draw.salesOpenTs) return "Sales have not opened yet.";
  if (nowSec >= draw.salesCloseTs) return "Sales are closed for this draw.";
  return null;
}

export function HomeLotterySection() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const { connected } = useWallet();
  const { setVisible } = useWalletModal();
  const programId = useMemo(() => lotteryProgramId(), []);

  const [draw, setDraw] = useState<LotteryDrawView | null>(null);
  const [jackpotLamports, setJackpotLamports] = useState<number | null>(null);
  const [nowSec, setNowSec] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [ticketCount, setTicketCount] = useState(1);
  const [payWith, setPayWith] = useState<"SOL" | string>("SOL");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  const refresh = useCallback(async () => {
    const d = await fetchLotteryDraw(connection, programId);
    setDraw(d);
    if (d) {
      setJackpotLamports(await fetchJackpotLamports(connection, d.prizeVault));
    } else {
      setJackpotLamports(null);
    }
    setNowSec(await chainUnixTs(connection));
  }, [connection, programId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await refresh();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    const poll = setInterval(() => {
      refresh().catch(() => undefined);
    }, 30_000);
    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, [refresh]);

  useEffect(() => {
    const tick = setInterval(() => {
      chainUnixTs(connection)
        .then(setNowSec)
        .catch(() => undefined);
    }, 1000);
    return () => clearInterval(tick);
  }, [connection]);

  const countdown = useMemo(() => {
    if (!draw || nowSec === null) return null;
    if (draw.state !== DrawState.Selling) {
      return { label: drawStateLabel(draw.state), parts: null as null };
    }
    if (nowSec < draw.salesOpenTs) {
      return {
        label: "Sales open in",
        parts: splitCountdown(draw.salesOpenTs - nowSec),
      };
    }
    if (nowSec < draw.salesCloseTs) {
      return {
        label: "Draw closes in",
        parts: splitCountdown(draw.salesCloseTs - nowSec),
      };
    }
    return { label: "Sales closed", parts: null };
  }, [draw, nowSec]);

  const buyable = Boolean(draw && nowSec !== null && isDrawBuyable(draw, nowSec));
  const splOptions: SplMintRowView[] = draw?.splMints ?? [];

  useEffect(() => {
    if (payWith !== "SOL" && !splOptions.some((o) => o.mint === payWith)) {
      setPayWith("SOL");
    }
  }, [payWith, splOptions]);

  const subtitle = useMemo(() => {
    if (payWith === "SOL") {
      return "0.01 SOL per ticket (+ 0.0005 SOL transaction fee)";
    }
    const opt = splOptions.find((o) => o.mint === payWith);
    if (!opt) return "";
    const left = opt.cap - opt.sold;
    return `SPL tickets remaining: ${left}/${opt.cap}`;
  }, [payWith, splOptions]);

  const ticketCostLamports = ticketCount * LAMPORTS_SOL_TICKET_PRICE;
  const feeCostLamports = ticketCount * LAMPORTS_SOL_TICKET_FEE;
  const totalCostLamports = ticketCostLamports + feeCostLamports;
  const disabledReason = draw ? buyDisabledReason(draw, nowSec, connected) : null;
  const canSubmit =
    buyable && Boolean(wallet) && payWith === "SOL" && phase.kind !== "busy";

  const onBuy = useCallback(async () => {
    if (!wallet || !draw || !buyable) return;
    if (payWith !== "SOL") {
      setPhase({
        kind: "error",
        message:
          "SPL ticket buys from the homepage are not wired yet. Use SOL for this draw.",
      });
      return;
    }
    setPhase({ kind: "busy", label: "Confirm in your wallet…" });
    try {
      const sig = await buySolTickets(
        connection,
        wallet,
        programId,
        draw,
        ticketCount,
      );
      const firstId = draw.totalTickets;
      const lastId = draw.totalTickets + ticketCount - 1;
      const ids =
        ticketCount === 1 ? `#${firstId}` : `#${firstId}–#${lastId}`;
      await refresh();
      setPhase({
        kind: "ok",
        message: `Purchased ${ticketCount} ticket(s) (${ids}).`,
        signature: sig,
      });
    } catch (e) {
      setPhase({
        kind: "error",
        message: e instanceof Error ? e.message : "Purchase failed.",
      });
    }
  }, [
    buyable,
    connection,
    draw,
    payWith,
    programId,
    refresh,
    ticketCount,
    wallet,
  ]);

  const countdownCells = countdown?.parts
    ? [
        [pad2(countdown.parts[0]), "days"],
        [pad2(countdown.parts[1]), "hrs"],
        [pad2(countdown.parts[2]), "min"],
        [pad2(countdown.parts[3]), "sec"],
      ]
    : [
        ["—", "days"],
        ["—", "hrs"],
        ["—", "min"],
        ["—", "sec"],
      ];

  return (
    <section className="space-y-8">
      <h2 className="text-balance text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        Play our fully onchain monthly lotto game
      </h2>

      {loading ? (
        <p className="text-sm text-muted">Loading on-chain draw…</p>
      ) : !draw ? (
        <p className="rounded-2xl border border-border bg-bg-elevated/70 p-6 text-sm text-muted">
          No lottery draw on this network yet. An admin can create one from the
          admin panel.
        </p>
      ) : (
        <>
          <p className="text-xs text-muted">
            Draw #{draw.drawId}{" "}
            <a
              href={solscanAccountUrl(draw.draw.toBase58())}
              className="font-mono text-accent-cyan hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              {draw.draw.toBase58().slice(0, 8)}…
            </a>
            · {draw.totalTickets} ticket{draw.totalTickets === 1 ? "" : "s"}{" "}
            sold
          </p>

          <DrawStatsGrid
            countdownLabel={countdown?.label ?? "—"}
            cells={countdownCells}
            jackpotSol={
              jackpotLamports !== null
                ? formatSolFromLamports(jackpotLamports)
                : "—"
            }
          />

          <div className="rounded-2xl border border-border bg-bg-elevated/70 p-6">
            <h3 className="text-lg font-semibold">Buy tickets</h3>
            <p className="mt-2 text-sm text-muted">{subtitle}</p>
            {payWith === "SOL" ? (
              <p className="mt-1 text-xs text-muted">
                Total: {formatSolFromLamports(ticketCostLamports)} tickets +{" "}
                {formatSolFromLamports(feeCostLamports)} fee ={" "}
                {formatSolFromLamports(totalCostLamports)} for {ticketCount}{" "}
                ticket{ticketCount === 1 ? "" : "s"}
              </p>
            ) : null}

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <label className="flex flex-col gap-2 text-xs text-muted">
                Pay with
                <select
                  value={payWith}
                  onChange={(e) => setPayWith(e.target.value)}
                  className="rounded-xl border border-neutral-400/80 bg-neutral-200 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-accent-purple focus:ring-2 focus:ring-accent-purple/30"
                >
                  <option value="SOL">SOL</option>
                  {splOptions.map((o) => {
                    const left = o.cap - o.sold;
                    const label = `${o.mint.slice(0, 4)}…${o.mint.slice(-4)} (${left}/${o.cap})`;
                    return (
                      <option key={o.mint} value={o.mint} disabled>
                        {label} — soon
                      </option>
                    );
                  })}
                </select>
              </label>

              <label className="flex flex-col gap-2 text-xs text-muted">
                Tickets
                <input
                  type="number"
                  min={1}
                  max={MAX_SOL_TICKETS_PER_BUY}
                  value={ticketCount}
                  onChange={(e) => {
                    const n = parseInt(e.target.value, 10);
                    if (Number.isFinite(n)) {
                      setTicketCount(
                        Math.min(MAX_SOL_TICKETS_PER_BUY, Math.max(1, n)),
                      );
                    }
                  }}
                  className="rounded-xl border border-neutral-400/80 bg-neutral-200 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-accent-purple focus:ring-2 focus:ring-accent-purple/30"
                />
              </label>

              <BuyTicketButton
                connected={connected}
                hasWallet={Boolean(wallet)}
                canSubmit={canSubmit}
                phase={phase}
                onConnect={() => setVisible(true)}
                onBuy={onBuy}
              />
            </div>

            {disabledReason && connected ? (
              <p className="mt-3 text-sm text-amber-100/90">{disabledReason}</p>
            ) : null}

            {phase.kind === "ok" ? (
              <div className="mt-4 rounded-xl border border-emerald-500/40 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-100">
                <p>{phase.message}</p>
                <p className="mt-1">
                  <a
                    href={solscanTxUrl(phase.signature)}
                    className="underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    View on Solscan
                  </a>
                </p>
              </div>
            ) : null}
            {phase.kind === "error" ? (
              <div className="mt-4 rounded-xl border border-red-500/40 bg-red-950/30 px-4 py-3 text-sm text-red-200">
                {phase.message}
              </div>
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}

function DrawStatsGrid({
  countdownLabel,
  cells,
  jackpotSol,
}: {
  countdownLabel: string;
  cells: string[][];
  jackpotSol: string;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-border bg-bg-elevated/70 p-6">
        <CountdownHeading label={countdownLabel} />
        <div className="mt-4 grid grid-cols-4 gap-3">
          {cells.map(([v, l]) => (
            <div
              key={l}
              className="rounded-xl border border-border bg-surface/50 p-3 text-center sm:p-4"
            >
              <div className="text-2xl font-semibold text-accent-gold sm:text-3xl lg:text-4xl">
                {v}
              </div>
              <CountdownUnitLabel l={l} />
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col items-center rounded-2xl border border-border bg-bg-elevated/70 p-6 text-center">
        <div className="text-xs font-semibold uppercase tracking-[0.25em] text-accent-gold">
          Live jackpot
        </div>
        <div className="mt-3 text-4xl font-black leading-none tracking-tight text-accent-gold [font-family:var(--font-zen-dots),var(--font-michroma),sans-serif] [letter-spacing:0.02em] sm:text-5xl lg:text-6xl">
          {jackpotSol}
        </div>
        <div className="mt-1 text-sm text-muted">SOL</div>
        <p className="mt-4 text-center text-xs text-muted">
          90% of SOL ticket purchases are added to the prize pot.
        </p>
      </div>
    </div>
  );
}

function CountdownHeading({ label }: { label: string }) {
  return (
    <div className="text-xs font-semibold uppercase tracking-[0.25em] text-accent-gold">
      {label}
    </div>
  );
}

function CountdownUnitLabel({ l }: { l: string }) {
  return (
    <div className="mt-1 text-[11px] uppercase tracking-wide text-muted">{l}</div>
  );
}

function BuyTicketButton({
  connected,
  hasWallet,
  canSubmit,
  phase,
  onConnect,
  onBuy,
}: {
  connected: boolean;
  hasWallet: boolean;
  canSubmit: boolean;
  phase: Phase;
  onConnect: () => void;
  onBuy: () => void;
}) {
  return (
    <div className="flex items-end">
      {!connected || !hasWallet ? (
        <button
          type="button"
          onClick={onConnect}
          className="w-full rounded-xl bg-gradient-to-r from-accent-purple to-accent-blue px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent-purple/20"
        >
          Connect wallet
        </button>
      ) : (
        <button
          type="button"
          disabled={!canSubmit}
          onClick={onBuy}
          className="w-full rounded-xl bg-gradient-to-r from-accent-purple to-accent-blue px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent-purple/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {phase.kind === "busy" ? phase.label : "Buy ticket(s)"}
        </button>
      )}
    </div>
  );
}
