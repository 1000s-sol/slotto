import {
  formatPredictedSeedSol,
  NEXT_SEED_FLOOR_SOL,
  predictedNextSeedSol,
  SPL_TICKETS_TO_RECOUP_SEED,
} from "@/lib/lottery/predicted-next-seed";

export function DrawSalesStats({
  totalTickets,
  splTicketsSold,
  compact = false,
}: {
  totalTickets: number;
  splTicketsSold: number;
  /** Tighter strip for the live draws table header. */
  compact?: boolean;
}) {
  const predicted = predictedNextSeedSol(splTicketsSold);
  const recouping = splTicketsSold < SPL_TICKETS_TO_RECOUP_SEED;
  const progress = Math.min(1, splTicketsSold / SPL_TICKETS_TO_RECOUP_SEED);

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        <span>
          <span className="text-foreground">{totalTickets.toLocaleString()}</span>{" "}
          tickets sold
        </span>
        <span className="text-border" aria-hidden>
          ·
        </span>
        <span>
          <span className="text-foreground">{splTicketsSold.toLocaleString()}</span>{" "}
          SPL
        </span>
        <span className="text-border" aria-hidden>
          ·
        </span>
        <span>
          Next seed ~{" "}
          <span className="font-semibold text-accent-gold">
            {formatPredictedSeedSol(predicted)} SOL
          </span>
        </span>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <StatCard label="Total tickets sold" value={totalTickets.toLocaleString()} />
      <StatCard label="SPL ticket sales" value={splTicketsSold.toLocaleString()} />
      <div className="flex flex-col items-center rounded-2xl border border-border bg-bg-elevated/70 p-5 text-center sm:items-stretch sm:text-left">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent-gold">
          Next seed (predicted)
        </div>
        <div className="mt-2 text-3xl font-black tracking-tight text-accent-gold [font-family:var(--font-zen-dots),var(--font-michroma),sans-serif] sm:text-4xl">
          {formatPredictedSeedSol(predicted)}
        </div>
        <div className="mt-0.5 text-sm text-muted">SOL</div>
        <p className="mt-3 text-[11px] leading-relaxed text-muted">
          Floor {NEXT_SEED_FLOOR_SOL} SOL until {SPL_TICKETS_TO_RECOUP_SEED.toLocaleString()}{" "}
          SPL tickets; then grows with more SPL sales. Prediction only.
        </p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface">
          <div
            className={`h-full rounded-full transition-all ${
              recouping ? "bg-accent-purple/80" : "bg-accent-gold"
            }`}
            style={{ width: `${Math.max(4, progress * 100)}%` }}
          />
        </div>
        <p className="mt-1.5 text-[10px] text-muted/80">
          {recouping
            ? `${splTicketsSold.toLocaleString()} / ${SPL_TICKETS_TO_RECOUP_SEED.toLocaleString()} SPL to unlock growth`
            : `Growing — ${Math.max(0, splTicketsSold - SPL_TICKETS_TO_RECOUP_SEED).toLocaleString()} SPL past threshold`}
        </p>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-border bg-bg-elevated/70 p-5 text-center sm:items-stretch sm:text-left">
      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
        {label}
      </div>
      <div className="mt-2 text-3xl font-black tracking-tight text-foreground [font-family:var(--font-zen-dots),var(--font-michroma),sans-serif] sm:text-4xl">
        {value}
      </div>
    </div>
  );
}
