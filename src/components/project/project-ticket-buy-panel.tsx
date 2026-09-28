"use client";

import {
  useConnection,
  useWallet,
} from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { PublicKey } from "@solana/web3.js";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import {
  PurchaseSuccessModal,
  type PurchaseSuccessDetails,
} from "@/components/lottery/purchase-success-modal";
import { SplPoolInfoButton } from "@/components/lottery/spl-pool-info-modal";
import { TicketCountInput } from "@/components/lottery/ticket-count-input";
import { ensureTicketChunksForPurchaseAction } from "@/app/admin/(dashboard)/lotteries/draw-infrastructure-actions";
import { notifyDiscordTicketSaleClient } from "@/lib/discord-ticket-bot/notify-client";
import { buySplTickets } from "@/lib/lottery/buy-spl-tickets";
import { isDrawBuyable, type LotteryDrawView } from "@/lib/lottery/chain";
import { lotteryProgramId } from "@/lib/lottery/config";
import {
  lotteryDrawPublicLabel,
  lotteryDrawViewFromJson,
} from "@/lib/lottery/draws";
import { fetchLotteryStateClient } from "@/lib/lottery/fetch-lottery-state-client";
import { fetchTickerPricesClient } from "@/lib/lottery/fetch-ticker-prices-client";
import { liquidSplPriceFromTickerItems } from "@/lib/lottery/liquid-ticket-price";
import { lotteryWalletSendOptsForBrowser } from "@/lib/lottery/lottery-wallet-client";
import { resolveSplQuotedPricePerTicket } from "@/lib/lottery/resolve-spl-quoted-price";
import { SPL_PRICING_LIQUID_DYNAMIC } from "@/lib/lottery/spl-pricing";
import { splBaseUnitsToUi } from "@/lib/lottery/spl-price";
import {
  clampTicketCountForPayWith,
  maxBuyableTicketsForPayWith,
  mergeSplMintsForBuyUi,
  splTicketsRemaining,
} from "@/lib/lottery/spl-mint-ui";
import type { SplMintUiRow } from "@/lib/lottery/spl-types";
import { useLotteryWallet } from "@/lib/lottery/use-lottery-wallet";
import { formatLotteryBuyError } from "@/lib/lottery/user-facing-error";
import { walletSendErrorSignature } from "@/lib/lottery/wallet-send-transaction";
import type { TickerPriceItem } from "@/lib/token-usd-prices";

type Phase =
  | { kind: "idle" }
  | { kind: "busy"; label: string }
  | { kind: "error"; message: string };

function formatTokenAmount(ui: string): string {
  const n = Number(ui);
  if (!Number.isFinite(n)) return ui;
  if (n === 0) return "0";
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (n >= 1) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (n >= 0.01) return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
  return Number(n.toPrecision(3)).toLocaleString("en-US", {
    maximumFractionDigits: 12,
  });
}

/**
 * Compact ticket buy UI for a project page — only renders when this project's
 * mint is published and buyable on the current public draw.
 */
export function ProjectTicketBuyPanel({
  mint,
  symbol,
  logoUrl,
  projectName,
}: {
  mint: string;
  symbol: string;
  logoUrl: string | null;
  projectName: string;
}) {
  const { connection } = useConnection();
  const wallet = useLotteryWallet();
  const { connected, sendTransaction } = useWallet();
  const { setVisible } = useWalletModal();
  const programId = useMemo(() => lotteryProgramId(), []);
  const mintKey = mint.trim();

  const [activeDraw, setActiveDraw] = useState<LotteryDrawView | null>(null);
  const [activeDrawLabel, setActiveDrawLabel] = useState<string | null>(null);
  const [vaultPubkeys, setVaultPubkeys] = useState<{
    teamVault: PublicKey;
    buxVault: PublicKey;
    setupVault: PublicKey;
  } | null>(null);
  const [nowSec, setNowSec] = useState<number | null>(null);
  const [splDbRows, setSplDbRows] = useState<
    Parameters<typeof mergeSplMintsForBuyUi>[1]
  >([]);
  const [tickerPrices, setTickerPrices] = useState<TickerPriceItem[]>([]);
  const [ticketCount, setTicketCount] = useState(1);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [loading, setLoading] = useState(true);
  const [purchase, setPurchase] = useState<{
    count: number;
    ids: string;
    payWith: string;
    signature: string;
  } | null>(null);

  const refresh = useCallback(async () => {
    const state = await fetchLotteryStateClient();
    setNowSec(state.nowSec);
    setVaultPubkeys({
      teamVault: new PublicKey(state.teamVault),
      buxVault: new PublicKey(state.buxVault),
      setupVault: new PublicKey(state.setupVault),
    });
    if (state.activeDraw) {
      setActiveDraw(lotteryDrawViewFromJson(state.activeDraw));
      setActiveDrawLabel(lotteryDrawPublicLabel(state.activeDraw));
    } else {
      setActiveDraw(null);
      setActiveDrawLabel(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await refresh();
      } catch {
        if (!cancelled) setActiveDraw(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    const id = setInterval(() => {
      void refresh().catch(() => undefined);
    }, 20_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [refresh]);

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

  useEffect(() => {
    if (!activeDraw) {
      setSplDbRows([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/lottery/draw-spl?drawId=${activeDraw.drawId}`,
        );
        const json = (await res.json()) as {
          rows?: Parameters<typeof mergeSplMintsForBuyUi>[1];
        };
        if (!cancelled) setSplDbRows(json.rows ?? []);
      } catch {
        if (!cancelled) setSplDbRows([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeDraw?.drawId]);

  const buyableWindow = Boolean(
    activeDraw && nowSec !== null && isDrawBuyable(activeDraw, nowSec),
  );

  const splUiRows = useMemo((): SplMintUiRow[] => {
    if (!activeDraw) return [];
    return mergeSplMintsForBuyUi(activeDraw.splMints, splDbRows, buyableWindow);
  }, [activeDraw, splDbRows, buyableWindow]);

  const mintRow = useMemo(
    () => splUiRows.find((r) => r.mint === mintKey) ?? null,
    [splUiRows, mintKey],
  );

  const mintBuyable = Boolean(mintRow?.buyable);

  useEffect(() => {
    if (!mintRow) return;
    setTicketCount((c) =>
      clampTicketCountForPayWith(c, mintKey, splUiRows),
    );
  }, [mintKey, mintRow, splUiRows]);

  const maxTickets = useMemo(
    () => maxBuyableTicketsForPayWith(mintKey, splUiRows),
    [mintKey, splUiRows],
  );

  const priceLabel = useMemo(() => {
    if (!mintRow) return null;
    try {
      const base =
        mintRow.pricingMode === SPL_PRICING_LIQUID_DYNAMIC
          ? liquidSplPriceFromTickerItems(
              tickerPrices,
              mintRow.mint,
              mintRow.decimals,
            )
          : BigInt(mintRow.pricePerTicket);
      const ui = formatTokenAmount(
        splBaseUnitsToUi(base.toString(), mintRow.decimals),
      );
      return mintRow.pricingMode === SPL_PRICING_LIQUID_DYNAMIC
        ? `~${ui} ${symbol} per ticket (live)`
        : `${ui} ${symbol} per ticket`;
    } catch {
      return mintRow.pricingMode === SPL_PRICING_LIQUID_DYNAMIC
        ? "Fetching live price…"
        : null;
    }
  }, [mintRow, tickerPrices, symbol]);

  const canSubmit =
    mintBuyable &&
    Boolean(wallet) &&
    Boolean(vaultPubkeys) &&
    phase.kind !== "busy" &&
    maxTickets > 0;

  const onBuy = useCallback(async () => {
    if (!activeDraw || !mintBuyable || !mintRow) return;
    if (!wallet) {
      setPhase({
        kind: "error",
        message:
          "Wallet is not ready to sign. Disconnect and reconnect Phantom, then try again.",
      });
      return;
    }
    if (!vaultPubkeys) {
      setPhase({
        kind: "error",
        message:
          "Lottery config still loading. Wait a moment and try again, or refresh the page.",
      });
      return;
    }
    const count = clampTicketCountForPayWith(ticketCount, mintKey, splUiRows);
    if (count !== ticketCount) setTicketCount(count);

    setPhase({ kind: "busy", label: "Preparing draw…" });
    const chunkPrep = await ensureTicketChunksForPurchaseAction(
      activeDraw.drawId,
      count,
    );
    if (!chunkPrep.ok && chunkPrep.error !== "Keeper not configured") {
      setPhase({ kind: "error", message: chunkPrep.error });
      return;
    }

    setPhase({ kind: "busy", label: "Confirm in your wallet…" });
    const sendOpts = lotteryWalletSendOptsForBrowser(wallet, sendTransaction);
    const ticketsBefore = activeDraw.totalTickets;
    const splSoldBefore =
      activeDraw.splMints.find((r) => r.mint === mintKey)?.sold ?? 0;

    try {
      const mintPk = new PublicKey(mintKey);
      const quoted = await resolveSplQuotedPricePerTicket(
        connection,
        programId,
        activeDraw,
        mintPk,
        tickerPrices,
      );
      const sig = await buySplTickets(
        connection,
        wallet,
        programId,
        activeDraw,
        mintPk,
        count,
        quoted,
        vaultPubkeys,
        sendOpts,
        symbol,
      );
      const firstId = activeDraw.totalTickets;
      const lastId = activeDraw.totalTickets + count - 1;
      const ids = count === 1 ? `#${firstId}` : `#${firstId}–#${lastId}`;
      void notifyDiscordTicketSaleClient({
        signature: sig,
        wallet: wallet.publicKey.toBase58(),
        drawId: activeDraw.drawId,
        count,
        payWith: mintKey,
        tokenSymbol: symbol,
        tokenName: projectName || symbol,
        tokenImageUrl: logoUrl,
      });
      await refresh();
      setPhase({ kind: "idle" });
      setPurchase({ count, ids, payWith: mintKey, signature: sig });
    } catch (e) {
      const partialSig = walletSendErrorSignature(e);
      if (partialSig && activeDraw) {
        setPhase({ kind: "busy", label: "Checking on-chain…" });
        await refresh();
        const state = await fetchLotteryStateClient();
        const updated = state.activeDraw
          ? lotteryDrawViewFromJson(state.activeDraw)
          : null;
        const ticketsAfter = updated?.totalTickets ?? ticketsBefore;
        const splSoldAfter =
          updated?.splMints.find((r) => r.mint === mintKey)?.sold ??
          splSoldBefore;
        if (
          updated &&
          ticketsAfter >= ticketsBefore + count &&
          splSoldAfter >= splSoldBefore + count
        ) {
          const firstId = ticketsBefore;
          const lastId = ticketsBefore + count - 1;
          const ids = count === 1 ? `#${firstId}` : `#${firstId}–#${lastId}`;
          void notifyDiscordTicketSaleClient({
            signature: partialSig,
            wallet: wallet.publicKey.toBase58(),
            drawId: activeDraw.drawId,
            count,
            payWith: mintKey,
            tokenSymbol: symbol,
            tokenName: projectName || symbol,
            tokenImageUrl: logoUrl,
          });
          setActiveDraw(updated);
          setPhase({ kind: "idle" });
          setPurchase({
            count,
            ids,
            payWith: mintKey,
            signature: partialSig,
          });
          return;
        }
      }
      setPhase({
        kind: "error",
        message: formatLotteryBuyError(e, { payWith: mintKey }),
      });
    }
  }, [
    activeDraw,
    connection,
    logoUrl,
    mintBuyable,
    mintKey,
    mintRow,
    programId,
    projectName,
    refresh,
    sendTransaction,
    splUiRows,
    symbol,
    ticketCount,
    tickerPrices,
    vaultPubkeys,
    wallet,
  ]);

  const purchaseDetails = useMemo((): PurchaseSuccessDetails | null => {
    if (!purchase) return null;
    return {
      count: purchase.count,
      ticketIds: purchase.ids,
      tokenSymbol: symbol,
      tokenName: projectName || symbol,
      tokenImageUrl: logoUrl,
      signature: purchase.signature,
      jackpotSol: null,
      projectXHandle: null,
    };
  }, [purchase, symbol, logoUrl, projectName]);

  if (loading || !mintKey) return null;
  // Mint not on the current public draw (or not published / locked / sold out).
  if (!mintRow || !mintRow.published || mintRow.purchasesLocked) return null;
  if (!mintRow.lotteryBuySupported) return null;

  const remaining = splTicketsRemaining(mintRow);
  const salesOpen = buyableWindow && mintBuyable;
  const soldPct =
    mintRow.displayCap > 0
      ? Math.min(
          100,
          Math.max(0, (mintRow.sold / mintRow.displayCap) * 100),
        )
      : 0;
  const soldPctLabel = `${Math.round(soldPct)}%`;

  return (
    <section className="rounded-xl border border-accent-gold/35 bg-bg-deep/50 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">
            Buy tickets with ${symbol}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {salesOpen
              ? `Current draw ${activeDrawLabel ?? "—"}. SPL tickets remaining: ${remaining}/${mintRow.displayCap}${
                  priceLabel ? ` · ${priceLabel}` : ""
                }`
              : buyableWindow
                ? `${symbol} tickets are sold out or capped for this draw.`
                : `Sales are closed for the current draw. ${symbol} will appear here again when it is enabled on an open draw.`}
          </p>
        </div>
        <Link
          href="/"
          className="shrink-0 text-xs font-medium text-accent-cyan hover:underline"
        >
          Full lottery →
        </Link>
      </div>

      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between gap-3 text-xs text-muted">
          <span>
            {mintRow.sold.toLocaleString()} /{" "}
            {mintRow.displayCap.toLocaleString()} sold
          </span>
          <span className="tabular-nums text-foreground/90">{soldPctLabel}</span>
        </div>
        <div
          className="h-2.5 w-full overflow-hidden rounded-full bg-surface/80"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(soldPct)}
          aria-label={`${symbol} ticket sales progress`}
        >
          <div
            className="h-full rounded-full bg-accent-gold transition-[width] duration-300 ease-out"
            style={{ width: `${soldPct}%` }}
          />
        </div>
      </div>

      <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted/90">
        <span>
          SPL purchases receive a 5% discount and are dynamically priced at time
          of purchase
        </span>
        <SplPoolInfoButton />
      </p>

      {salesOpen ? (
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <label className="flex min-w-0 flex-col gap-2 text-xs text-muted">
            Tickets
            <TicketCountInput
              value={ticketCount}
              max={maxTickets}
              disabled={phase.kind === "busy"}
              onChange={(n) =>
                setTicketCount(
                  clampTicketCountForPayWith(n, mintKey, splUiRows),
                )
              }
            />
          </label>
          <div className="flex items-end">
            {!connected || !wallet ? (
              <button
                type="button"
                onClick={() => setVisible(true)}
                className="flex min-h-[3.5rem] w-full items-center justify-center rounded-xl bg-gradient-to-r from-accent-purple to-accent-blue px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent-purple/20 sm:w-auto"
              >
                Connect wallet
              </button>
            ) : (
              <button
                type="button"
                disabled={!canSubmit}
                onClick={() => void onBuy()}
                className="flex min-h-[3.5rem] w-full items-center justify-center rounded-xl bg-gradient-to-r from-accent-purple to-accent-blue px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent-purple/20 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                {phase.kind === "busy" ? phase.label : `Buy with $${symbol}`}
              </button>
            )}
          </div>
        </div>
      ) : null}

      {phase.kind === "error" ? (
        <div className="mt-4 rounded-xl border border-red-500/40 bg-red-950/30 px-4 py-3 text-sm text-red-200">
          {phase.message}
        </div>
      ) : null}

      <PurchaseSuccessModal
        open={purchase !== null}
        onClose={() => setPurchase(null)}
        details={purchaseDetails}
      />
    </section>
  );
}
