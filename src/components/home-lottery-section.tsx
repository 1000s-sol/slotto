"use client";

import {
  useAnchorWallet,
  useConnection,
  useWallet,
} from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { useCallback, useEffect, useMemo, useState } from "react";

import { LotteryWinnerPanel } from "@/components/lottery/lottery-winner-panel";
import {
  PayWithSelect,
  type PayWithOption,
} from "@/components/lottery/pay-with-select";
import {
  PurchaseSuccessModal,
  type PurchaseSuccessDetails,
} from "@/components/lottery/purchase-success-modal";
import { SplPoolInfoButton } from "@/components/lottery/spl-pool-info-modal";
import { TicketCountInput } from "@/components/lottery/ticket-count-input";
import { fetchWalletSocialsClient } from "@/lib/fetch-wallet-social-client";
import type { WalletSocialPublic } from "@/lib/social-profile-url";
import { buySolTickets } from "@/lib/lottery/buy-sol-tickets";
import { buySplTickets } from "@/lib/lottery/buy-spl-tickets";
import { fetchTickerPricesClient } from "@/lib/lottery/fetch-ticker-prices-client";
import { resolveSplQuotedPricePerTicket } from "@/lib/lottery/resolve-spl-quoted-price";
import { liquidSplPriceFromTickerItems } from "@/lib/lottery/liquid-ticket-price";
import type { TickerPriceItem } from "@/lib/token-usd-prices";
import { SPL_PRICING_LIQUID_DYNAMIC } from "@/lib/lottery/spl-pricing";
import { splBaseUnitsToUi } from "@/lib/lottery/spl-price";
import { isDrawBuyable, type LotteryDrawView } from "@/lib/lottery/chain";
import {
  DrawState,
  LAMPORTS_PER_SOL_TICKET,
  LAMPORTS_SOL_BUY_FEE_BUFFER,
  MAX_SOL_TICKETS_PER_BUY,
} from "@/lib/lottery/constants";
import { lotteryProgramId } from "@/lib/lottery/config";
import {
  FREE_ENTRY_MINT,
  FREE_ENTRY_PRICE_PER_TICKET,
  freeEntryConfigured,
  isFreeEntryMint,
} from "@/lib/lottery/free-entry";
import { drawNeedsSettlement } from "@/lib/lottery/draw-settlement";
import { formatLotteryBuyError } from "@/lib/lottery/user-facing-error";
import {
  fetchWinnerPrizeLamports,
  formatSolFromLamports,
  lotteryDrawViewFromJson,
} from "@/lib/lottery/draws";
import { fetchLotteryStateClient } from "@/lib/lottery/fetch-lottery-state-client";
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
  | { kind: "error"; message: string };

const X_URL = "https://x.com/slottogg_";
const SOL_MINT = "So11111111111111111111111111111111111111112";

type PayTokenMeta = {
  mint: string;
  symbol: string;
  name: string;
  imageUrl: string | null;
  liquid: boolean;
};

function formatTokenAmount(ui: string): string {
  const n = Number(ui);
  if (!Number.isFinite(n)) return ui;
  if (n === 0) return "0";
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (n >= 1) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (n >= 0.01) return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
  // Sub-0.01 prices: keep ~3 significant figures so tiny amounts stay readable.
  return Number(n.toPrecision(3)).toLocaleString("en-US", {
    maximumFractionDigits: 12,
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
  const { connected, sendTransaction } = useWallet();
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
  const [purchase, setPurchase] = useState<{
    count: number;
    ids: string;
    payWith: "SOL" | string;
    signature: string;
  } | null>(null);
  const [splUiRows, setSplUiRows] = useState<SplMintUiRow[]>([]);
  const [tokenMeta, setTokenMeta] = useState<Record<string, PayTokenMeta>>({});
  const [tickerPrices, setTickerPrices] = useState<TickerPriceItem[]>([]);
  const [liquidQuoteUi, setLiquidQuoteUi] = useState<string | null>(null);
  const [liquidQuoteLoading, setLiquidQuoteLoading] = useState(false);
  const [walletLamports, setWalletLamports] = useState<number | null>(null);
  const [holdsFreeEntry, setHoldsFreeEntry] = useState(false);

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
    try {
      const state = await fetchLotteryStateClient();
      setNowSec(state.nowSec);

      if (state.activeDraw) {
        const inProgress = lotteryDrawViewFromJson(state.activeDraw);
        setActiveDraw(inProgress);
        setSettledDraw(null);
        setWinnerPrizeLamports(null);
        setWinnerSocial(null);
        setJackpotLamports(state.jackpotLamports);
      } else {
        setActiveDraw(null);
        setJackpotLamports(null);
        const settled = state.settledDraw
          ? lotteryDrawViewFromJson(state.settledDraw)
          : null;
        setSettledDraw(settled);
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
    } catch (e) {
      // Background load failures must stay silent — the page retries on its
      // own poll interval. Never surface RPC noise to visitors.
      console.warn(
        "[lottery] load failed (will retry):",
        e instanceof Error ? e.message : e,
      );
    }
  }, [connection]);

  useAutoSettleDraw(activeDraw, nowSec, refresh, (result) => {
    // Settlement runs on the server keeper with no visitor interaction, so any
    // failure is logged for debugging but never shown on the homepage.
    if (!result.ok && result.error) {
      console.warn("[lottery] auto-settle:", result.error);
    }
  });

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
      setNowSec((s) => (s !== null ? s + 1 : s));
    }, 1000);
    return () => clearInterval(tick);
  }, []);

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
    if (!buyable && phase.kind === "busy") {
      setPhase({ kind: "idle" });
    }
  }, [buyable, phase.kind]);

  useEffect(() => {
    if (!connected || !wallet?.publicKey) {
      setWalletLamports(null);
      return;
    }
    let cancelled = false;
    void connection
      .getBalance(wallet.publicKey, "confirmed")
      .then((lamports) => {
        if (!cancelled) setWalletLamports(lamports);
      })
      .catch(() => {
        if (!cancelled) setWalletLamports(null);
      });
    return () => {
      cancelled = true;
    };
  }, [connection, connected, wallet?.publicKey, phase.kind]);

  // Holder-gate the free-entry option: only surface it when the connected
  // wallet actually holds ≥1 token. Re-checks after each buy (phase.kind).
  useEffect(() => {
    if (!connected || !wallet?.publicKey || !freeEntryConfigured()) {
      setHoldsFreeEntry(false);
      return;
    }
    let cancelled = false;
    const ata = getAssociatedTokenAddressSync(
      new PublicKey(FREE_ENTRY_MINT),
      wallet.publicKey,
    );
    void connection
      .getTokenAccountBalance(ata, "confirmed")
      .then((bal) => {
        if (!cancelled) {
          setHoldsFreeEntry(
            BigInt(bal.value.amount) >= BigInt(FREE_ENTRY_PRICE_PER_TICKET),
          );
        }
      })
      .catch(() => {
        if (!cancelled) setHoldsFreeEntry(false);
      });
    return () => {
      cancelled = true;
    };
  }, [connection, connected, wallet?.publicKey, phase.kind]);

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

  useEffect(() => {
    const drawId = activeDraw?.drawId;
    if (drawId === undefined) {
      setTokenMeta({});
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/lottery/draw-tokens?drawId=${drawId}`, {
          cache: "no-store",
        });
        const json = (await res.json()) as {
          tokens?: Record<string, PayTokenMeta>;
        };
        if (!cancelled && json.tokens) setTokenMeta(json.tokens);
      } catch {
        if (!cancelled) setTokenMeta({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeDraw?.drawId]);

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

  // Single source of truth for per-ticket token cost, quoted live from the same
  // ticker feed used at purchase time. Both the dropdown and the info text read
  // this map, so the two values always match (and update as the price moves).
  const liveCostUiByMint = useMemo(() => {
    const out: Record<string, string> = {};
    for (const o of splUiRows) {
      try {
        const base =
          o.pricingMode === SPL_PRICING_LIQUID_DYNAMIC
            ? liquidSplPriceFromTickerItems(tickerPrices, o.mint, o.decimals)
            : BigInt(o.pricePerTicket);
        out[o.mint] = formatTokenAmount(
          splBaseUnitsToUi(base.toString(), o.decimals),
        );
      } catch {
        // No live price yet (ticker feed still loading) — leave unset.
      }
    }
    return out;
  }, [splUiRows, tickerPrices]);

  const splSubtitle = useMemo(() => {
    if (payWith === "SOL") return null;
    const opt = splUiRows.find((o) => o.mint === payWith);
    if (!opt) return "";
    const left = splTicketsRemaining(opt);
    const live = liveCostUiByMint[opt.mint];
    const priceHint =
      opt.pricingMode === SPL_PRICING_LIQUID_DYNAMIC
        ? live
          ? ` · ~${live} per ticket (live)`
          : " · fetching live price…"
        : live
          ? ` · ${live} per ticket`
          : "";
    return `SPL tickets remaining: ${left}/${opt.displayCap}${priceHint}`;
  }, [payWith, splUiRows, liveCostUiByMint]);

  const disabledReason = buyDisabledReason(buyable, connected);
  const selectedSpl = splUiRows.find((o) => o.mint === payWith);
  const solRequiredLamports =
    ticketCount * LAMPORTS_PER_SOL_TICKET + LAMPORTS_SOL_BUY_FEE_BUFFER;
  const hasEnoughSolForBuy =
    payWith !== "SOL" ||
    walletLamports === null ||
    walletLamports >= solRequiredLamports;

  const canSubmit =
    buyable &&
    Boolean(wallet) &&
    phase.kind !== "busy" &&
    hasEnoughSolForBuy &&
    (payWith === "SOL" || Boolean(selectedSpl?.buyable));

  const onBuy = useCallback(async () => {
    if (!activeDraw || !buyable) return;
    if (!wallet) {
      setPhase({
        kind: "error",
        message:
          "Wallet is not ready to sign. Disconnect and reconnect Phantom, then try again.",
      });
      return;
    }
    const count = clampTicketCountForPayWith(
      ticketCount,
      payWith,
      splUiRows,
    );
    if (count !== ticketCount) {
      setTicketCount(count);
    }
    setPhase({ kind: "busy", label: "Confirm in your wallet…" });
    const sendOpts = { sendTransaction };
    try {
      const sig =
        payWith === "SOL"
          ? await buySolTickets(
              connection,
              wallet,
              programId,
              activeDraw,
              count,
              sendOpts,
              nowSec ?? undefined,
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
              const splLabel =
                tokenMeta[payWith]?.symbol ??
                splUiRows.find((o) => o.mint === payWith)?.symbol;
              return buySplTickets(
                connection,
                wallet,
                programId,
                activeDraw,
                mint,
                count,
                quoted,
                sendOpts,
                splLabel,
              );
            })();
      const firstId = activeDraw.totalTickets;
      const lastId = activeDraw.totalTickets + count - 1;
      const ids = count === 1 ? `#${firstId}` : `#${firstId}–#${lastId}`;
      const boughtWith = payWith;
      await refresh();
      setPhase({ kind: "idle" });
      setPurchase({ count, ids, payWith: boughtWith, signature: sig });
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
    tokenMeta,
    nowSec,
    sendTransaction,
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

  const payOptions = useMemo<PayWithOption[]>(() => {
    const solMeta = tokenMeta[SOL_MINT];
    const opts: PayWithOption[] = [
      {
        value: "SOL",
        name: solMeta?.name ?? "Solana",
        symbol: "SOL",
        imageUrl: solMeta?.imageUrl ?? null,
        remaining: null,
        cap: null,
        costLabel: "0.01 SOL",
        disabled: false,
        soldOut: false,
      },
    ];
    for (const o of splUiRows) {
      if (!o.published || o.purchasesLocked) continue;
      // Free-entry is a permanent draw option, but only shown to holders.
      if (isFreeEntryMint(o.mint) && !holdsFreeEntry) continue;
      const meta = tokenMeta[o.mint];
      const symbol = meta?.symbol ?? o.symbol;
      const remaining = splTicketsRemaining(o);
      const isLiquid = o.pricingMode === SPL_PRICING_LIQUID_DYNAMIC;
      const live = liveCostUiByMint[o.mint];
      const costLabel = live
        ? `${isLiquid ? "~" : ""}${live} ${symbol}`
        : symbol;
      opts.push({
        value: o.mint,
        name: meta?.name ?? symbol,
        symbol,
        imageUrl: meta?.imageUrl ?? null,
        remaining,
        cap: o.displayCap,
        costLabel,
        disabled: !o.buyable,
        soldOut: remaining <= 0,
      });
    }
    return opts;
  }, [splUiRows, tokenMeta, liveCostUiByMint, holdsFreeEntry]);

  // If the wallet no longer holds a free-entry token (e.g. just spent it),
  // drop the now-hidden selection back to SOL.
  useEffect(() => {
    if (isFreeEntryMint(payWith) && !holdsFreeEntry) setPayWith("SOL");
  }, [payWith, holdsFreeEntry]);

  const purchaseDetails = useMemo<PurchaseSuccessDetails | null>(() => {
    if (!purchase) return null;
    const metaKey = purchase.payWith === "SOL" ? SOL_MINT : purchase.payWith;
    const meta = tokenMeta[metaKey];
    const isSol = purchase.payWith === "SOL";
    return {
      count: purchase.count,
      ticketIds: purchase.ids,
      tokenSymbol: meta?.symbol ?? (isSol ? "SOL" : ""),
      tokenName: meta?.name ?? (isSol ? "Solana" : (meta?.symbol ?? "tokens")),
      tokenImageUrl: meta?.imageUrl ?? null,
      signature: purchase.signature,
      jackpotSol:
        jackpotLamports !== null ? formatSolFromLamports(jackpotLamports) : null,
    };
  }, [purchase, tokenMeta, jackpotLamports]);

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

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-end">
              <label className="flex min-w-0 flex-col gap-2 text-center text-xs text-muted sm:text-left">
                Pay with
                <PayWithSelect
                  value={payWith}
                  options={payOptions}
                  disabled={buySectionDisabled}
                  onChange={(next) => {
                    setPayWith(next);
                    setTicketCount((c) =>
                      clampTicketCountForPayWith(c, next, splUiRows),
                    );
                  }}
                />
              </label>

              <label className="flex min-w-0 flex-col gap-2 text-center text-xs text-muted sm:text-left">
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

            {connected && wallet?.publicKey && payWith === "SOL" ? (
              <p className="mt-3 text-xs text-muted">
                Connected wallet balance (mainnet RPC):{" "}
                <span className="font-mono text-foreground">
                  {walletLamports !== null
                    ? `${(walletLamports / 1e9).toFixed(4)} SOL`
                    : "…"}
                </span>
                {walletLamports !== null && !hasEnoughSolForBuy ? (
                  <span className="text-amber-200/90">
                    {" "}
                    — need ~{(solRequiredLamports / 1e9).toFixed(4)} SOL for this
                    purchase.
                  </span>
                ) : null}
              </p>
            ) : null}

            {disabledReason ? (
              <p className="mt-3 text-sm text-amber-100/90">{disabledReason}</p>
            ) : null}

            {needsSettlement && activeDraw?.totalTickets === 0 ? (
              <p className="mt-4 text-sm text-amber-100/90">
                No tickets were sold. The server keeper is closing this draw and
                refunding the seed SOL — no wallet action needed.
              </p>
            ) : null}
            {phase.kind === "error" ? (
              <div className="mt-4 rounded-xl border border-red-500/40 bg-red-950/30 px-4 py-3 text-sm text-red-200">
                {phase.message}
              </div>
            ) : null}
          </div>
        </>
      )}

      <PurchaseSuccessModal
        open={purchase !== null}
        onClose={() => setPurchase(null)}
        details={purchaseDetails}
      />
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
          className="flex min-h-[3.5rem] w-full items-center justify-center rounded-xl bg-gradient-to-r from-accent-purple to-accent-blue px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent-purple/20"
        >
          Connect wallet
        </button>
      ) : (
        <button
          type="button"
          disabled={!canSubmit}
          onClick={onBuy}
          className="flex min-h-[3.5rem] w-full items-center justify-center rounded-xl bg-gradient-to-r from-accent-purple to-accent-blue px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent-purple/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {phase.kind === "busy" ? phase.label : "Buy ticket(s)"}
        </button>
      )}
    </div>
  );
}
