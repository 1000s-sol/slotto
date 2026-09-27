"use client";

import { useCallback, useEffect, useId, useState } from "react";

import type {
  BuybackSnapshot,
  BuybackTokenRow,
} from "@/lib/lottery/buyback-data";

type Currency = "SOL" | "USDC";

function formatTickets(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function formatTokensHeld(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n === 0) return "0";
  if (n >= 1_000_000) {
    return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  if (n >= 1) {
    return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
  }
  return n.toLocaleString(undefined, { maximumSignificantDigits: 6 });
}

function formatMoney(
  currency: Currency,
  sol: number | null,
  usd: number | null,
): string {
  if (currency === "SOL") {
    if (sol == null || !Number.isFinite(sol)) return "—";
    return `${sol.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    })} SOL`;
  }
  if (usd == null || !Number.isFinite(usd)) return "—";
  return `$${usd.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function avatarFallbacks(url: string | null): string[] {
  if (!url) return [];
  const out = [url];
  const cidMatch = url.match(/\/ipfs\/([^/?#]+)/i);
  if (cidMatch) {
    const cid = cidMatch[1];
    for (const gateway of [
      `https://cloudflare-ipfs.com/ipfs/${cid}`,
      `https://nftstorage.link/ipfs/${cid}`,
      `https://ipfs.io/ipfs/${cid}`,
    ]) {
      if (!out.includes(gateway)) out.push(gateway);
    }
  }
  // Phantom’s image proxy often succeeds when origin hosts block hotlinking.
  const proxied = `https://api.phantom.app/image-proxy/?image=${encodeURIComponent(url)}`;
  if (!out.includes(proxied)) out.push(proxied);
  return out;
}

function TokenAvatar({
  imageUrl,
  symbol,
}: {
  imageUrl: string | null;
  symbol: string;
}) {
  const candidates = avatarFallbacks(imageUrl);
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    setIdx(0);
  }, [imageUrl]);
  const cls =
    "h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-border";
  const src = candidates[idx] ?? null;
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={src}
        alt=""
        className={cls}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => {
          setIdx((i) => (i + 1 < candidates.length ? i + 1 : candidates.length));
        }}
      />
    );
  }
  const initial =
    (symbol || "?").replace(/[^A-Za-z0-9]/g, "").slice(0, 1).toUpperCase() ||
    "?";
  return (
    <span
      className={`${cls} inline-flex items-center justify-center bg-surface text-xs font-bold text-muted`}
      aria-hidden
    >
      {initial}
    </span>
  );
}

function DrawBreakdownModal({
  row,
  onClose,
}: {
  row: BuybackTokenRow;
  onClose: () => void;
}) {
  const titleId = useId();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const total = row.draws.reduce((s, d) => s + d.ticketsSold, 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[min(90vh,640px)] w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-bg-elevated shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex items-center gap-3 min-w-0">
            <TokenAvatar imageUrl={row.imageUrl} symbol={row.symbol} />
            <div className="min-w-0">
              <h2
                id={titleId}
                className="truncate text-lg font-semibold text-foreground"
              >
                {row.name}
              </h2>
              <p className="text-xs text-muted">{row.symbol} ticket sales</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-2.5 py-1 text-sm text-muted hover:text-foreground"
          >
            Close
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-3">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-muted">
                <th className="py-2 pr-3 font-medium">Draw</th>
                <th className="py-2 pr-3 font-medium">Date</th>
                <th className="py-2 text-right font-medium">Tickets</th>
              </tr>
            </thead>
            <tbody>
              {row.draws.map((d) => (
                <tr
                  key={d.onChainDrawId}
                  className="border-t border-border/60"
                >
                  <td className="py-2.5 pr-3 font-medium text-foreground">
                    {d.displayLabel}
                  </td>
                  <td className="py-2.5 pr-3 text-muted">{d.salesCloseDate}</td>
                  <td className="py-2.5 text-right tabular-nums">
                    {formatTickets(d.ticketsSold)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border">
                <td
                  colSpan={2}
                  className="py-3 pr-3 text-sm font-semibold text-foreground"
                >
                  Total
                </td>
                <td className="py-3 text-right text-sm font-semibold tabular-nums text-accent-cyan">
                  {formatTickets(total)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

export function BuybackPageClient() {
  const [currency, setCurrency] = useState<Currency>("SOL");
  const [data, setData] = useState<BuybackSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<BuybackTokenRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/buyback", { cache: "no-store" });
      const json = (await res.json()) as BuybackSnapshot & { error?: string };
      if (!res.ok) {
        throw new Error(json.error || "Failed to load buyback data");
      }
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load buyback data");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">Buyback</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted">
          Profit from SPL token ticket sales is passed on to the associated
          projects through token buybacks. Slotto holds project tokens received
          from ticket purchases and offers founders a buyback at{" "}
          <span className="text-foreground">90% of current market value</span>
          — a 10% saving versus buying the same tokens on the open market.
        </p>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted">
          Production draws only. Holdings in Slotto team vault.
        </p>
        <div
          className="inline-flex rounded-xl border border-border bg-bg-elevated/70 p-0.5"
          role="group"
          aria-label="Display currency"
        >
          {(["SOL", "USDC"] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCurrency(c)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                currency === c
                  ? "bg-accent-cyan/20 text-accent-cyan"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="rounded-2xl border border-border bg-bg-elevated/70 p-6 text-sm text-muted">
          Loading buyback data…
        </p>
      ) : null}

      {error ? (
        <div className="space-y-3 rounded-2xl border border-red-500/40 bg-red-500/10 p-6">
          <p className="text-sm text-red-200">{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-bg-elevated"
          >
            Retry
          </button>
        </div>
      ) : null}

      {!loading && !error && data && data.tokens.length === 0 ? (
        <p className="rounded-2xl border border-border bg-bg-elevated/70 p-6 text-sm text-muted">
          No project tokens on production draws yet.
        </p>
      ) : null}

      {!loading && !error && data && data.tokens.length > 0 ? (
        <div className="overflow-x-auto rounded-2xl border border-border bg-bg-elevated/70">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3 font-medium">Token</th>
                <th className="px-4 py-3 font-medium text-right">
                  Total sales
                </th>
                <th className="px-4 py-3 font-medium text-right">
                  Tokens held
                </th>
                <th className="px-4 py-3 font-medium text-right">
                  Current value
                </th>
                <th className="px-4 py-3 font-medium text-right">
                  Buyback (90%)
                </th>
                <th className="px-4 py-3 font-medium text-right">
                  Project saving
                </th>
              </tr>
            </thead>
            <tbody>
              {data.tokens.map((row) => (
                <tr
                  key={row.mint}
                  className="cursor-pointer border-b border-border/50 transition hover:bg-white/5"
                  onClick={() => setSelected(row)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelected(row);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={`Open sales breakdown for ${row.name}`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <TokenAvatar
                        imageUrl={row.imageUrl}
                        symbol={row.symbol}
                      />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">
                          {row.name}
                        </p>
                        <p className="truncate text-xs text-muted">
                          {row.symbol}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatTickets(row.totalTicketsSold)}
                    <span className="ml-1 text-xs text-muted">tickets</span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatTokensHeld(row.tokensHeld)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatMoney(currency, row.valueSol, row.valueUsd)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-accent-cyan">
                    {formatMoney(currency, row.buybackSol, row.buybackUsd)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-accent-gold">
                    {formatMoney(currency, row.savingSol, row.savingUsd)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {data ? (
        <p className="text-xs text-muted">
          Prices refresh about every minute. Click a row for ticket sales by
          draw.
        </p>
      ) : null}

      {selected ? (
        <DrawBreakdownModal
          row={selected}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </div>
  );
}
