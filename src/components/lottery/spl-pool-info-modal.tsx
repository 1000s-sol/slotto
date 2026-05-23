"use client";

import { useCallback, useEffect, useId, useState, type ReactNode } from "react";

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}

function FlowArrow() {
  return (
    <div className="flex justify-center py-1 text-accent-gold/70" aria-hidden>
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
        <path d="M12 4l-1.4 1.4 4.6 4.6H4v2h11.2l-4.6 4.6L12 20l8-8-8-8z" transform="rotate(90 12 12)" />
      </svg>
    </div>
  );
}

function StepCard({
  icon,
  title,
  children,
  accent = "gold",
}: {
  icon: string;
  title: string;
  children: ReactNode;
  accent?: "gold" | "purple" | "cyan";
}) {
  const ring =
    accent === "purple"
      ? "ring-accent-purple/30 bg-accent-purple/10"
      : accent === "cyan"
        ? "ring-accent-cyan/30 bg-accent-cyan/10"
        : "ring-accent-gold/30 bg-accent-gold/10";
  return (
    <div className={`rounded-xl border border-border p-4 ring-1 ${ring}`}>
      <div className="flex items-start gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface text-lg"
          aria-hidden
        >
          {icon}
        </span>
        <div>
          <h4 className="font-semibold text-foreground">{title}</h4>
          <p className="mt-1 text-sm leading-relaxed text-muted">{children}</p>
        </div>
      </div>
    </div>
  );
}

export function SplPoolInfoModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[min(90vh,720px)] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-bg-elevated shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h3 id={titleId} className="text-lg font-semibold text-foreground">
              What happens to SPL ticket payments?
            </h3>
            <p className="mt-1 text-sm text-muted">
              SPL buys don&apos;t add to this month&apos;s live SOL jackpot — they
              fuel next month&apos;s seed instead.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-muted hover:bg-surface hover:text-foreground"
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" stroke="currentColor" strokeWidth="2" fill="none">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-2 px-5 py-4">
          <StepCard icon="🎟️" title="During this draw" accent="purple">
            Every SPL ticket you buy sends <strong className="text-foreground">100%</strong> of
            those tokens to the team pool for this draw. They accumulate until sales close.
          </StepCard>

          <FlowArrow />

          <StepCard icon="🔄" title="After the draw ends" accent="gold">
            All pooled project tokens are converted to SOL. That SOL becomes the{" "}
            <strong className="text-foreground">seed jackpot</strong> for the next
            month&apos;s draw — not the current live pot.
          </StepCard>

          <FlowArrow />

          <div className="rounded-xl border border-border bg-surface/40 p-4">
            <p className="mb-3 text-center text-xs font-semibold uppercase tracking-wider text-muted">
              Two ways we convert to SOL
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-accent-cyan/30 bg-accent-cyan/5 p-3 text-center">
                <span className="text-2xl" aria-hidden>
                  🤝
                </span>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  Founder buyback
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  Projects are offered a buyback at{" "}
                  <strong className="text-accent-cyan">90% of market value</strong>.
                </p>
              </div>
              <div className="rounded-lg border border-accent-purple/30 bg-accent-purple/5 p-3 text-center">
                <span className="text-2xl" aria-hidden>
                  📈
                </span>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  Open market
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  If a project declines buyback, tokens are sold on the open market
                  at prevailing prices.
                </p>
              </div>
            </div>
          </div>

          <FlowArrow />

          <StepCard icon="🌱" title="Next month's draw" accent="cyan">
            Converted SOL seeds the new prize pool so every SPL community contributes
            to growing the next jackpot — while SOL tickets grow{" "}
            <strong className="text-foreground">this month&apos;s</strong> live pot in
            real time.
          </StepCard>
        </div>

        <div className="border-t border-border px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-gradient-to-r from-accent-purple to-accent-blue px-4 py-2.5 text-sm font-semibold text-white"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

export function SplPoolInfoButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-surface/80 text-muted transition hover:border-accent-cyan/50 hover:text-accent-cyan"
        }
        aria-label="How SPL ticket payments work"
        title="How SPL ticket payments work"
      >
        <InfoIcon className="h-4 w-4" />
      </button>
      <SplPoolInfoModal open={open} onClose={close} />
    </>
  );
}
