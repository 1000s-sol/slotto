"use client";

import { useEffect, useRef, useState } from "react";

export type PayWithOption = {
  value: string;
  name: string;
  symbol: string;
  imageUrl: string | null;
  /** Remaining / cap for SPL mints; null for SOL (unlimited). */
  remaining: number | null;
  cap: number | null;
  costLabel: string;
  disabled: boolean;
  soldOut: boolean;
};

function Avatar({
  imageUrl,
  symbol,
  size = 24,
}: {
  imageUrl: string | null;
  symbol: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [imageUrl]);
  const dim = `${size}px`;
  const cls = "shrink-0 rounded-full object-cover ring-1 ring-border";
  if (imageUrl && !failed) {
    return (
      <img
        src={imageUrl}
        alt={symbol}
        className={cls}
        style={{ width: dim, height: dim }}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    );
  }
  const initial =
    (symbol || "?").replace(/[^A-Za-z0-9]/g, "").slice(0, 1).toUpperCase() || "?";
  return (
    <span
      className={`${cls} inline-flex items-center justify-center bg-surface text-[10px] font-bold text-muted`}
      style={{ width: dim, height: dim }}
      aria-hidden
    >
      {initial}
    </span>
  );
}

function OptionBody({ opt }: { opt: PayWithOption }) {
  return (
    <>
      <Avatar imageUrl={opt.imageUrl} symbol={opt.symbol} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-1.5">
          <span className="truncate font-medium text-foreground">{opt.name}</span>
          {opt.soldOut ? (
            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-amber-300/90">
              sold out
            </span>
          ) : null}
        </span>
        <span className="flex flex-wrap items-center gap-x-2 text-[11px] text-muted">
          <span>{opt.costLabel}</span>
          {opt.remaining !== null && opt.cap !== null ? (
            <span className="text-muted/70">
              · {opt.remaining}/{opt.cap} left
            </span>
          ) : null}
        </span>
      </span>
    </>
  );
}

export function PayWithSelect({
  value,
  options,
  disabled,
  onChange,
}: {
  value: string;
  options: PayWithOption[];
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-[3.5rem] w-full items-center gap-2.5 rounded-xl border border-border bg-surface/80 px-3 py-2.5 pr-9 text-left text-sm shadow-inner shadow-black/10 outline-none transition hover:border-accent-purple/30 focus:border-accent-purple/50 focus:ring-4 focus:ring-accent-purple/15 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {selected ? (
          <OptionBody opt={selected} />
        ) : (
          <span className="text-muted">Select token</span>
        )}
        <span
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted"
          aria-hidden
        >
          ▾
        </span>
      </button>

      {open ? (
        <ul
          role="listbox"
          className="absolute z-30 mt-1.5 max-h-72 w-full overflow-auto rounded-xl border border-white/15 bg-[color-mix(in_srgb,var(--surface)_80%,white)] p-1 shadow-xl shadow-black/50"
        >
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <li key={opt.value} role="option" aria-selected={isSelected}>
                <button
                  type="button"
                  disabled={opt.disabled}
                  onClick={() => {
                    if (opt.disabled) return;
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-45 ${
                    isSelected
                      ? "bg-accent-purple/30"
                      : "hover:bg-black/20"
                  }`}
                >
                  <OptionBody opt={opt} />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
