"use client";

import { useMemo, useState } from "react";

const SPL_OPTIONS = [
  { mint: "ProjectA1111111111111111111111111111111111", label: "PROJECT A", remaining: "17/50" },
  { mint: "ProjectB1111111111111111111111111111111111", label: "PROJECT B", remaining: "3/25" },
];

export function HomeLotterySection() {
  const [payWith, setPayWith] = useState<"SOL" | string>("SOL");

  const subtitle = useMemo(() => {
    if (payWith === "SOL") return "0.01 SOL per ticket";
    const opt = SPL_OPTIONS.find((o) => o.mint === payWith);
    return opt ? `SPL tickets remaining: ${opt.remaining}` : "";
  }, [payWith]);

  return (
    <section className="space-y-8">
      <h2 className="text-balance text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        Play our fully onchain monthly lotto game
      </h2>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-bg-elevated/70 p-6">
          <div className="text-xs font-semibold uppercase tracking-[0.25em] text-accent-gold">
            Draws in
          </div>
          <div className="mt-4 grid grid-cols-4 gap-3">
            {[
              ["02", "days"],
              ["14", "hrs"],
              ["33", "min"],
              ["09", "sec"],
            ].map(([v, l]) => (
              <div key={l} className="rounded-xl border border-border bg-surface/50 p-3 text-center sm:p-4">
                <div className="text-2xl font-semibold text-accent-gold sm:text-3xl lg:text-4xl">{v}</div>
                <div className="mt-1 text-[11px] uppercase tracking-wide text-muted">{l}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-center rounded-2xl border border-border bg-bg-elevated/70 p-6 text-center">
          <div className="text-xs font-semibold uppercase tracking-[0.25em] text-accent-gold">
            Live jackpot
          </div>
          <div className="mt-3 text-4xl font-black leading-none tracking-tight text-accent-gold [font-family:var(--font-zen-dots),var(--font-michroma),sans-serif] [letter-spacing:0.02em] sm:text-5xl lg:text-6xl">
            5.59
          </div>
          <div className="mt-1 text-sm text-muted">SOL</div>
          <p className="mt-4 text-center text-xs text-muted">
            Winner claims 90%.
            <br />
            <span className="inline-block whitespace-nowrap">10% supports platform development.</span>
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-bg-elevated/70 p-6">
        <h3 className="text-lg font-semibold">Buy tickets</h3>
        <p className="mt-2 text-sm text-muted">{subtitle}</p>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-2 text-xs text-muted">
            Pay with
            <select
              value={payWith}
              onChange={(e) => setPayWith(e.target.value as typeof payWith)}
              className="rounded-xl border border-neutral-400/80 bg-neutral-200 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-accent-purple focus:ring-2 focus:ring-accent-purple/30"
            >
              <option value="SOL">SOL</option>
              {SPL_OPTIONS.map((o) => (
                <option key={o.mint} value={o.mint}>
                  {o.label} ({o.remaining})
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2 text-xs text-muted">
            Tickets
            <input
              type="number"
              min={1}
              defaultValue={1}
              className="rounded-xl border border-neutral-400/80 bg-neutral-200 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-accent-purple focus:ring-2 focus:ring-accent-purple/30"
            />
          </label>

          <div className="flex items-end">
            <button
              type="button"
              className="w-full rounded-xl bg-gradient-to-r from-accent-purple to-accent-blue px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent-purple/20"
            >
              Buy ticket(s)
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
