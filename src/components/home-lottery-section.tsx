"use client";

import { useAnchorWallet, useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { PublicKey } from "@solana/web3.js";
import { useCallback, useEffect, useMemo, useState } from "react";

import { LotteryWinnerPanel } from "@/components/lottery/lottery-winner-panel";
import { SiteSelect } from "@/components/ui/site-select";
import { fetchWalletSocialsClient } from "@/lib/fetch-wallet-social-client";
import type { WalletSocialPublic } from "@/lib/social-profile-url";
import { buySolTickets } from "@/lib/lottery/buy-sol-tickets";
import { buySplTickets } from "@/lib/lottery/buy-spl-tickets";
import {
  chainUnixTs,
  fetchJackpotLamports,
  isDrawBuyable,
  type LotteryDrawView,
} from "@/lib/lottery/chain";
import { DrawState, MAX_SOL_TICKETS_PER_BUY } from "@/lib/lottery/constants";
import { lotteryProgramId, solscanTxUrl } from "@/lib/lottery/config";
import { drawNeedsSettlement } from "@/lib/lottery/draw-settlement";
import {
  fetchInProgressDraw,
  fetchLatestSettledDraw,
  fetchWinnerPrizeLamports,
  formatSolFromLamports,
} from "@/lib/lottery/draws";
import { mergeSplMintsForBuyUi } from "@/lib/lottery/spl-mint-ui";
import type { SplMintUiRow } from "@/lib/lottery/spl-types";
import { useAutoSettleDraw } from "@/lib/lottery/use-auto-settle-draw";

type Phase =
  | { kind: "idle" }
  | { kind: "busy"; label: string }
  | { kind: "ok"; message: string; signature: string }
  | { kind: "error"; message: string };

const X_URL = "https://x.com/slottogg_";

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

function buyDisabledReason(
  buyable: boolean,
  connected: boolean,
): string | null {
  if (!connected) return "Connect your wallet to buy tickets.";
  if (!buyable) return null;
  return null;
}

export function HomeLotterySection() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const { connected } = useWallet();
  const { setVisible } = useWalletModal();
  const programId = useMemo(() => lotteryProgramId(), []);

  const [activeDraw, setActiveDraw] = useState<LotteryDrawView | null>(null);
  const [settledDraw, setSettledDraw] = useState<LotteryDrawView | null>(null);
  const [jackpotLamports, setJackpotLamports] = useState<number | null>(null);
  const [winnerPrizeLamports, setWinnerPrizeLamports] = useState<number | null>(
    null,
  );
  const [winnerSocial, setWinnerSocial] = useState<WalletSocialPublic | null>(
    null,
  );
  const [nowSec, setNowSec] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [ticketCount, setTicketCount] = useState(1);
  const [payWith, setPayWith] = useState<"SOL" | string>("SOL");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [splUiRows, setSplUiRows] = useState<SplMintUiRow[]>([]);
  const [settleError, setSettleError] = useState<string | null>(null);

  const needsSettlement = Boolean(
    activeDraw && drawNeedsSettlement(activeDraw, nowSec),
  );
  const settling = needsSettlement;
  const showWinner = Boolean(
    !activeDraw && !settling && settledDraw?.winner,
  );
  const draw = activeDraw ?? settledDraw;

  const refresh = useCallback(async () => {
    const inProgress = await fetchInProgressDraw(connection, programId);
    setActiveDraw(inProgress);
    if (inProgress) {
      setSettledDraw(null);
      setWinnerPrizeLamports(null);
      setWinnerSocial(null);
      if (inProgress.state === DrawState.Selling) {
        setJackpotLamports(
          await fetchJackpotLamports(connection, inProgress.prizeVault),
        );
      } else {
        setJackpotLamports(null);
      }
    } else {
      const settled = await fetchLatestSettledDraw(connection, programId);
      setSettledDraw(settled);
      setJackpotLamports(null);
      if (settled?.winner) {
        const [prize, socials] = await Promise.all([
          fetchWinnerPrizeLamports(connection, settled.winner, settled),
          fetchWalletSocialsClient([settled.winner]),
        ]);
        setWinnerPrizeLamports(prize);
        setWinnerSocial(socials[settled.winner] ?? null);
      } else {
        setWinnerPrizeLamports(null);
        setWinnerSocial(null);
      }
    }
    setNowSec(await chainUnixTs(connection));
  }, [connection, programId]);

  useAutoSettleDraw(activeDraw, nowSec, refresh, (msg) => setSettleError(msg));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await refresh();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    const pollMs = needsSettlement ? 4_000 : 30_000;
    const poll = setInterval(() => {
      refresh().catch(() => undefined);
    }, pollMs);
    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, [refresh, needsSettlement]);

  useEffect(() => {
    const tick = setInterval(() => {
      chainUnixTs(connection)
        .then(setNowSec)
        .catch(() => undefined);
    }, 1000);
    return () => clearInterval(tick);
  }, [connection]);

  const countdown = useMemo(() => {
    if (showWinner) {
      return { kind: "next-draw" as const, parts: null };
    }
    if (!activeDraw || nowSec === null) return null;
    if (drawNeedsSettlement(activeDraw, nowSec)) {
      return {
        kind: "label" as const,
        label: "Drawing winner…",
        parts: null,
      };
    }
    if (activeDraw.state !== DrawState.Selling) {
      return { kind: "label" as const, label: "Sales closed", parts: null };
    }
    if (nowSec < activeDraw.salesOpenTs) {
      return {
        kind: "countdown" as const,
        label: "Sales open in",
        parts: splitCountdown(activeDraw.salesOpenTs - nowSec),
      };
    }
    if (nowSec < activeDraw.salesCloseTs) {
      return {
        kind: "countdown" as const,
        label: "Draw closes in",
        parts: splitCountdown(activeDraw.salesCloseTs - nowSec),
      };
    }
    return { kind: "label" as const, label: "Sales closed", parts: null };
  }, [activeDraw, nowSec, showWinner, needsSettlement]);

  const buyable = Boolean(
    activeDraw && nowSec !== null && isDrawBuyable(activeDraw, nowSec),
  );

  useEffect(() => {
    if (!activeDraw) {
      setSplUiRows([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/lottery/draw-spl?drawId=${activeDraw.drawId}`,
          { cache: "no-store" },
        );
        const json = (await res.json()) as { rows?: Parameters<
          typeof mergeSplMintsForBuyUi
        >[1] };
        if (cancelled) return;
        setSplUiRows(
          mergeSplMintsForBuyUi(
            activeDraw.splMints,
            json.rows ?? [],
            buyable,
          ),
        );
      } catch {
        if (!cancelled) {
          setSplUiRows(
            mergeSplMintsForBuyUi(activeDraw.splMints, [], buyable),
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeDraw, buyable]);

  const splBuyable = splUiRows.filter((o) => o.buyable);

  useEffect(() => {
    if (payWith !== "SOL" && !splBuyable.some((o) => o.mint === payWith)) {
      setPayWith("SOL");
    }
  }, [payWith, splBuyable]);

  const splSubtitle = useMemo(() => {
    if (payWith === "SOL") return null;
    const opt = splUiRows.find((o) => o.mint === payWith);
    if (!opt) return "";
    const left = Math.max(0, opt.displayCap - opt.sold);
    return `SPL tickets remaining: ${left}/${opt.displayCap}`;
  }, [payWith, splUiRows]);

  const disabledReason = buyDisabledReason(buyable, connected);
  const selectedSpl = splUiRows.find((o) => o.mint === payWith);
  const canSubmit =
    buyable &&
    Boolean(wallet) &&
    phase.kind !== "busy" &&
    (payWith === "SOL" || Boolean(selectedSpl?.buyable));

  const onBuy = useCallback(async () => {
    if (!wallet || !activeDraw || !buyable) return;
    setPhase({ kind: "busy", label: "Confirm in your wallet…" });
    try {
      const sig =
        payWith === "SOL"
          ? await buySolTickets(
              connection,
              wallet,
              programId,
              activeDraw,
              ticketCount,
            )
          : await buySplTickets(
              connection,
              wallet,
              programId,
              activeDraw,
              new PublicKey(payWith),
              ticketCount,
            );
      const firstId = activeDraw.totalTickets;
      const lastId = activeDraw.totalTickets + ticketCount - 1;
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
    activeDraw,
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

  const buySectionDisabled = !buyable;

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
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-border bg-bg-elevated/70 p-6">
              {countdown?.kind === "next-draw" ? (
                <>
                  <p className="text-sm leading-relaxed text-foreground sm:text-base">
                    Next draw starting soon… follow us on{" "}
                    <a
                      href={X_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-accent-cyan hover:underline"
                    >
                      X
                    </a>{" "}
                    for updates.
                  </p>
                  <div className="mt-4 grid grid-cols-4 gap-3">
                    {countdownCells.map(([v, l]) => (
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
                </>
              ) : (
                <>
                  <CountdownHeading
                    label={
                      countdown?.kind === "countdown"
                        ? countdown.label
                        : countdown?.label ?? "—"
                    }
                  />
                  <div className="mt-4 grid grid-cols-4 gap-3">
                    {countdownCells.map(([v, l]) => (
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
                </>
              )}
            </div>

            {showWinner && settledDraw?.winner ? (
              <LotteryWinnerPanel
                wallet={settledDraw.winner}
                discord={winnerSocial?.discord}
                x={winnerSocial?.x}
                prizeSol={formatSolFromLamports(winnerPrizeLamports ?? 0)}
                drawId={settledDraw.drawId}
                winningTicketId={settledDraw.winningTicketId}
              />
            ) : (
              <div className="flex flex-col items-center rounded-2xl border border-border bg-bg-elevated/70 p-6 text-center">
                <div className="text-xs font-semibold uppercase tracking-[0.25em] text-accent-gold">
                  Live jackpot
                </div>
                <div className="mt-3 text-4xl font-black leading-none tracking-tight text-accent-gold [font-family:var(--font-zen-dots),var(--font-michroma),sans-serif] sm:text-5xl lg:text-6xl">
                  {jackpotLamports !== null
                    ? formatSolFromLamports(jackpotLamports)
                    : "—"}
                </div>
                <div className="mt-1 text-sm text-muted">SOL</div>
                <p className="mt-4 text-center text-xs text-muted">
                  90% of SOL ticket purchases are added to the prize pot.
                </p>
              </div>
            )}
          </div>

          <div
            className={`rounded-2xl border border-border bg-bg-elevated/70 p-6 transition ${
              buySectionDisabled
                ? "pointer-events-none opacity-55 saturate-50"
                : ""
            }`}
          >
            <h3 className="text-lg font-semibold">Buy tickets</h3>
            <p className="mt-2 text-sm text-muted">
              {payWith === "SOL" ? (
                <>
                  0.01 SOL per ticket{" "}
                  <span className="text-[11px] text-muted/75">
                    (+ 0.0005 SOL transaction fee)
                  </span>
                </>
              ) : (
                splSubtitle
              )}
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <label className="flex flex-col gap-2 text-xs text-muted">
                Pay with
                <SiteSelect
                  value={payWith}
                  onChange={(e) => setPayWith(e.target.value)}
                  disabled={buySectionDisabled}
                >
                  <option value="SOL">SOL</option>
                  {splUiRows
                    .filter((o) => o.published && !o.purchasesLocked)
                    .map((o) => {
                      const left = Math.max(0, o.displayCap - o.sold);
                      const label = `${o.symbol || o.mint.slice(0, 4)} (${left}/${o.displayCap})`;
                      return (
                        <option
                          key={o.mint}
                          value={o.mint}
                          disabled={!o.buyable}
                        >
                          {label}
                          {!o.buyable ? " — sold out" : ""}
                        </option>
                      );
                    })}
                </SiteSelect>
              </label>

              <label className="flex flex-col gap-2 text-xs text-muted">
                Tickets
                <input
                  type="number"
                  min={1}
                  max={MAX_SOL_TICKETS_PER_BUY}
                  value={ticketCount}
                  disabled={buySectionDisabled}
                  onChange={(e) => {
                    const n = parseInt(e.target.value, 10);
                    if (Number.isFinite(n)) {
                      setTicketCount(
                        Math.min(MAX_SOL_TICKETS_PER_BUY, Math.max(1, n)),
                      );
                    }
                  }}
                  className="rounded-xl border border-neutral-400/80 bg-neutral-200 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-accent-purple focus:ring-2 focus:ring-accent-purple/30 disabled:cursor-not-allowed"
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

            {disabledReason ? (
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
            {settleError ? (
              <div className="mt-4 rounded-xl border border-red-500/40 bg-red-950/30 px-4 py-3 text-sm text-red-200">
                Settlement: {settleError}
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
