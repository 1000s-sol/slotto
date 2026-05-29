"use client";

import { useAnchorWallet, useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { PublicKey } from "@solana/web3.js";
import { useCallback, useEffect, useMemo, useState } from "react";

import { LotteryWinnerPanel } from "@/components/lottery/lottery-winner-panel";
import { WalletClusterBanner } from "@/components/lottery/wallet-cluster-banner";
import { SplPoolInfoButton } from "@/components/lottery/spl-pool-info-modal";
import { TicketCountInput } from "@/components/lottery/ticket-count-input";
import { SiteSelect } from "@/components/ui/site-select";
import { fetchWalletSocialsClient } from "@/lib/fetch-wallet-social-client";
import type { WalletSocialPublic } from "@/lib/social-profile-url";
import { buySolTickets } from "@/lib/lottery/buy-sol-tickets";
import { buySplTickets } from "@/lib/lottery/buy-spl-tickets";
import { fetchTickerPricesClient } from "@/lib/lottery/fetch-ticker-prices-client";
import { resolveSplQuotedPricePerTicket } from "@/lib/lottery/resolve-spl-quoted-price";
import type { TickerPriceItem } from "@/lib/token-usd-prices";
import { SPL_PRICING_LIQUID_DYNAMIC } from "@/lib/lottery/spl-pricing";
import { splBaseUnitsToUi } from "@/lib/lottery/spl-price";
import {
  chainUnixTs,
  fetchJackpotLamports,
  isDrawBuyable,
  type LotteryDrawView,
} from "@/lib/lottery/chain";
import { DrawState, MAX_SOL_TICKETS_PER_BUY } from "@/lib/lottery/constants";
import { lotteryProgramId, solscanTxUrl } from "@/lib/lottery/config";
import { drawNeedsSettlement } from "@/lib/lottery/draw-settlement";
import { formatLotteryBuyError } from "@/lib/lottery/user-facing-error";
import {
  fetchInProgressDraw,
  fetchLatestSettledDraw,
  fetchWinnerPrizeLamports,
  formatSolFromLamports,
} from "@/lib/lottery/draws";
import {
  clampTicketCountForPayWith,
  maxBuyableTicketsForPayWith,
  mergeSplMintsForBuyUi,
  splTicketsRemaining,
} from "@/lib/lottery/spl-mint-ui";
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
  const [tickerPrices, setTickerPrices] = useState<TickerPriceItem[]>([]);
  const [liquidQuoteUi, setLiquidQuoteUi] = useState<string | null>(null);
  const [liquidQuoteLoading, setLiquidQuoteLoading] = useState(false);
  const [settleError, setSettleError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const items = await fetchTickerPricesClient();
        if (!cancelled) setTickerPrices(items);
      } catch {
        if (!cancelled) setTickerPrices([]);
      }
    };
    void load();
    const id = setInterval(() => void load(), 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

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

  useAutoSettleDraw(activeDraw, nowSec, refresh, (result) => {
    if (result.ok) setSettleError(null);
    else if (result.error) setSettleError(result.error);
  });

  useEffect(() => {
    if (!needsSettlement) setSettleError(null);
  }, [needsSettlement]);

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
        label:
          activeDraw.totalTickets === 0
            ? "Closing empty draw…"
            : "Drawing winner…",
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

  const maxTicketsForSelection = useMemo(
    () => maxBuyableTicketsForPayWith(payWith, splUiRows),
    [payWith, splUiRows],
  );

  useEffect(() => {
    setTicketCount((c) =>
      clampTicketCountForPayWith(c, payWith, splUiRows),
    );
  }, [payWith, splUiRows]);

  const splSubtitle = useMemo(() => {
    if (payWith === "SOL") return null;
    const opt = splUiRows.find((o) => o.mint === payWith);
    if (!opt) return "";
    const left = splTicketsRemaining(opt);
    const priceHint =
      opt.pricingMode === SPL_PRICING_LIQUID_DYNAMIC
        ? liquidQuoteLoading
          ? " · fetching live price…"
          : liquidQuoteUi
            ? ` · ~${liquidQuoteUi} per ticket (live)`
            : ""
        : "";
    return `SPL tickets remaining: ${left}/${opt.displayCap}${priceHint}`;
  }, [payWith, splUiRows, liquidQuoteUi, liquidQuoteLoading]);

  useEffect(() => {
    if (payWith === "SOL" || !activeDraw) {
      setLiquidQuoteUi(null);
      return;
    }
    const opt = splUiRows.find((o) => o.mint === payWith);
    if (!opt || opt.pricingMode !== SPL_PRICING_LIQUID_DYNAMIC) {
      setLiquidQuoteUi(null);
      return;
    }
    let cancelled = false;
    setLiquidQuoteLoading(true);
    void resolveSplQuotedPricePerTicket(
      connection,
      programId,
      activeDraw,
      new PublicKey(payWith),
      tickerPrices,
    )
      .then((q) => {
        if (!cancelled) {
          setLiquidQuoteUi(splBaseUnitsToUi(q.toString(), opt.decimals));
        }
      })
      .catch(() => {
        if (!cancelled) setLiquidQuoteUi(null);
      })
      .finally(() => {
        if (!cancelled) setLiquidQuoteLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeDraw, connection, payWith, programId, splUiRows, tickerPrices]);

  const disabledReason = buyDisabledReason(buyable, connected);
  const selectedSpl = splUiRows.find((o) => o.mint === payWith);
  const canSubmit =
    buyable &&
    Boolean(wallet) &&
    phase.kind !== "busy" &&
    (payWith === "SOL" || Boolean(selectedSpl?.buyable));

  const onBuy = useCallback(async () => {
    if (!wallet || !activeDraw || !buyable) return;
    const count = clampTicketCountForPayWith(
      ticketCount,
      payWith,
      splUiRows,
    );
    if (count !== ticketCount) {
      setTicketCount(count);
    }
    setPhase({ kind: "busy", label: "Confirm in your wallet…" });
    try {
      const sig =
        payWith === "SOL"
          ? await buySolTickets(
              connection,
              wallet,
              programId,
              activeDraw,
              count,
            )
          : await (async () => {
              const mint = new PublicKey(payWith);
              const quoted = await resolveSplQuotedPricePerTicket(
                connection,
                programId,
                activeDraw,
                mint,
                tickerPrices,
              );
              return buySplTickets(
                connection,
                wallet,
                programId,
                activeDraw,
                mint,
                count,
                quoted,
              );
            })();
      const firstId = activeDraw.totalTickets;
      const lastId = activeDraw.totalTickets + count - 1;
      const ids = count === 1 ? `#${firstId}` : `#${firstId}–#${lastId}`;
      await refresh();
      setPhase({
        kind: "ok",
        message: `Purchased ${count} ticket(s) (${ids}).`,
        signature: sig,
      });
    } catch (e) {
      setPhase({
        kind: "error",
        message: formatLotteryBuyError(e, { payWith }),
      });
    }
  }, [
    buyable,
    connection,
    activeDraw,
    payWith,
    programId,
    refresh,
    splUiRows,
    ticketCount,
    tickerPrices,
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
            <div className="mt-3">
              <WalletClusterBanner />
            </div>
            <p className="mt-2 text-sm text-muted">
              {payWith === "SOL" ? (
                <>
                  0.01 SOL per ticket{" "}
                  <span className="text-[11px] text-muted/75">
                    (+ 0.0005 SOL platform fee)
                  </span>
                </>
              ) : (
                splSubtitle
              )}
            </p>
            <ul className="mt-3 space-y-1.5 text-xs text-muted/90">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0 text-accent-gold" aria-hidden>
                  ◆
                </span>
                <span>Only SOL ticket sales increase the current jackpot</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0 text-accent-purple" aria-hidden>
                  ◆
                </span>
                <span className="flex flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                  <span>
                    SPL purchases receive a 5% discount and are dynamically priced at
                    time of purchase
                  </span>
                  <SplPoolInfoButton />
                </span>
              </li>
            </ul>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <label className="flex flex-col gap-2 text-xs text-muted">
                Pay with
                <SiteSelect
                  value={payWith}
                  onChange={(e) => {
                    const next = e.target.value;
                    setPayWith(next);
                    setTicketCount((c) =>
                      clampTicketCountForPayWith(c, next, splUiRows),
                    );
                  }}
                  disabled={buySectionDisabled}
                >
                  <option value="SOL">SOL</option>
                  {splUiRows
                    .filter((o) => o.published && !o.purchasesLocked)
                    .map((o) => {
                      const left = splTicketsRemaining(o);
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
                <TicketCountInput
                  value={ticketCount}
                  max={maxTicketsForSelection}
                  disabled={buySectionDisabled}
                  onChange={(n) =>
                    setTicketCount(
                      clampTicketCountForPayWith(n, payWith, splUiRows),
                    )
                  }
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
            {needsSettlement &&
            activeDraw?.totalTickets === 0 &&
            !connected ? (
              <p className="mt-4 text-sm text-amber-100/90">
                No tickets were sold. Connect a wallet to finish closing this draw
                (permissionless; you only pay a small tx fee).
              </p>
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
