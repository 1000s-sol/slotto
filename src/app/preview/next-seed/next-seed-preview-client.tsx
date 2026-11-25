"use client";

import { useMemo, useState } from "react";

import { DrawSalesStats } from "@/components/lottery/draw-sales-stats";
import {
  expectedSolPerSplTicket,
  formatPredictedSeedSol,
  NEXT_SEED_FLOOR_SOL,
  predictedNextSeedSol,
  SPL_TICKETS_TO_RECOUP_SEED,
} from "@/lib/lottery/predicted-next-seed";

const PRESETS = [
  { label: "Quiet (120 SPL)", total: 280, spl: 120 },
  { label: "Near threshold (390 SPL)", total: 620, spl: 390 },
  { label: "Just unlocked (396 SPL)", total: 640, spl: 396 },
  { label: "Busy (800 SPL)", total: 1400, spl: 800 },
] as const;

export function NextSeedPreviewClient() {
  const [totalTickets, setTotalTickets] = useState(640);
  const [splTickets, setSplTickets] = useState(396);

  const solTickets = Math.max(0, totalTickets - splTickets);
  const predicted = predictedNextSeedSol(splTickets);
  const perTicket = expectedSolPerSplTicket();

  const mathLine = useMemo(() => {
    if (splTickets <= SPL_TICKETS_TO_RECOUP_SEED) {
      return `Still recouping — display stays at ${NEXT_SEED_FLOOR_SOL} SOL floor.`;
    }
    const extra = splTickets - SPL_TICKETS_TO_RECOUP_SEED;
    return `${extra.toLocaleString()} × ${perTicket.toFixed(4)} SOL ≈ +${(extra * perTicket).toFixed(3)} SOL over floor → ${formatPredictedSeedSol(predicted)} SOL`;
  }, [splTickets, perTicket, predicted]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-bg-elevated/55 p-4 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
              Fake draw
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-foreground sm:text-3xl">
              Draw #99 · Apr 2026
            </h1>
            <p className="mt-1 text-sm text-muted">
              Mock selling period — SOL live jackpot not shown here.
            </p>
          </div>
          <p className="font-mono text-xs text-muted">
            SOL tickets ≈ {solTickets.toLocaleString()} · SPL ≈{" "}
            {splTickets.toLocaleString()}
          </p>
        </div>

        <div className="mt-6">
          <DrawSalesStats totalTickets={totalTickets} splTicketsSold={splTickets} />
        </div>

        <div className="mt-6 rounded-2xl border border-border bg-surface/30 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">
            Compact strip (draws table style)
          </p>
          <div className="mt-3">
            <DrawSalesStats
              totalTickets={totalTickets}
              splTicketsSold={splTickets}
              compact
            />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-bg-elevated/70 p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-foreground">Tune fake stats</h2>
        <p className="mt-1 text-xs text-muted">{mathLine}</p>

        <label className="mt-5 block text-xs text-muted">
          Total tickets sold
          <input
            type="range"
            min={0}
            max={2500}
            step={1}
            value={totalTickets}
            onChange={(e) => {
              const next = Number(e.target.value);
              setTotalTickets(next);
              setSplTickets((s) => Math.min(s, next));
            }}
            className="mt-2 w-full accent-accent-gold"
          />
          <span className="mt-1 block font-mono text-sm text-foreground">
            {totalTickets.toLocaleString()}
          </span>
        </label>

        <label className="mt-5 block text-xs text-muted">
          SPL ticket sales
          <input
            type="range"
            min={0}
            max={Math.max(totalTickets, 1)}
            step={1}
            value={Math.min(splTickets, totalTickets)}
            onChange={(e) => setSplTickets(Number(e.target.value))}
            className="mt-2 w-full accent-accent-purple"
          />
          <span className="mt-1 block font-mono text-sm text-foreground">
            {Math.min(splTickets, totalTickets).toLocaleString()} / threshold{" "}
            {SPL_TICKETS_TO_RECOUP_SEED.toLocaleString()}
          </span>
        </label>

        <div className="mt-5 flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => {
                setTotalTickets(p.total);
                setSplTickets(p.spl);
              }}
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground transition hover:border-accent-purple/40"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
