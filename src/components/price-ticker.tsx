"use client";

import { useCallback, useEffect, useState } from "react";

type TickerItem = {
  mint: string;
  symbol: string;
  priceUsd: number | null;
  logoUrl: string | null;
};

const SOL_MINT = "So11111111111111111111111111111111111111112";

function birdeyeTokenUrl(mint: string) {
  return `https://birdeye.so/solana/token/${mint}`;
}

function fmtUsd(n: number | null): string {
  if (n == null || Number.isNaN(n)) return "—";
  if (n >= 1)
    return n.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  if (n >= 0.0001)
    return n.toLocaleString("en-US", { maximumFractionDigits: 6 });
  return n.toExponential(2);
}

function TokenThumb({ item }: { item: TickerItem }) {
  const cls =
    "h-4 w-4 shrink-0 rounded-full object-cover ring-1 ring-border sm:h-[18px] sm:w-[18px]";
  if (item.logoUrl) {
    return (
      <img
        src={item.logoUrl}
        alt=""
        className={cls}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
      />
    );
  }
  const initial = (item.symbol || "?").replace(/[^A-Za-z0-9]/g, "").slice(0, 1).toUpperCase() || "?";
  return (
    <span
      className={`flex ${cls} items-center justify-center bg-surface text-[8px] font-bold text-muted`}
      aria-hidden
    >
      {initial}
    </span>
  );
}

function TickerStrip({ items, track }: { items: TickerItem[]; track: "a" | "b" }) {
  return (
    <div className="flex items-center gap-4 pr-6">
      {items.map((t, i) => (
        <span key={`${track}-${t.mint}-${i}`} className="inline-flex items-center gap-4">
          {i > 0 ? <span className="select-none text-[10px] text-muted/40">|</span> : null}
          <a
            href={birdeyeTokenUrl(t.mint)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 whitespace-nowrap text-[11px] font-medium tabular-nums leading-none transition hover:text-accent-cyan sm:text-xs"
          >
            <TokenThumb item={t} />
            <span className="inline-flex items-baseline gap-1">
              <span className={t.mint === SOL_MINT ? "text-accent-gold" : "text-muted"}>
                {t.symbol}
              </span>
              <span className="text-foreground">${fmtUsd(t.priceUsd)}</span>
            </span>
          </a>
        </span>
      ))}
    </div>
  );
}

export function PriceTicker() {
  const [items, setItems] = useState<TickerItem[] | undefined>(undefined);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/ticker-prices", { cache: "no-store" });
      const json = (await res.json()) as { items?: TickerItem[] };
      if (Array.isArray(json.items) && json.items.length) setItems(json.items);
      else setItems([]);
    } catch {
      setItems([]);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 60_000);
    return () => clearInterval(id);
  }, [load]);

  if (items === undefined) {
    return (
      <div className="ticker-font border-b border-border bg-bg-elevated/50 py-2.5 text-center text-xs text-muted">
        Loading market data…
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="ticker-font border-b border-border bg-bg-elevated/50 py-2.5 text-center text-xs text-muted">
        Price feed unavailable.
      </div>
    );
  }

  return (
    <div className="ticker-font border-b border-border bg-bg-elevated/50">
      <div className="relative overflow-hidden py-1.5">
        <div className="ticker-track">
          <TickerStrip items={items} track="a" />
          <TickerStrip items={items} track="b" />
        </div>
      </div>
    </div>
  );
}
