"use client";

import { useEffect, useState } from "react";

type TicketCountInputProps = {
  value: number;
  min?: number;
  max: number;
  disabled?: boolean;
  onChange: (value: number) => void;
};

export function TicketCountInput({
  value,
  min = 1,
  max,
  disabled,
  onChange,
}: TicketCountInputProps) {
  const [draft, setDraft] = useState(String(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(String(value));
  }, [value, focused]);

  const clamp = (n: number) => Math.min(max, Math.max(min, n));

  const commitDraft = (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed === "") {
      const next = clamp(min);
      setDraft(String(next));
      onChange(next);
      return;
    }
    const n = parseInt(trimmed, 10);
    if (!Number.isFinite(n)) {
      setDraft(String(value));
      return;
    }
    const next = clamp(n);
    setDraft(String(next));
    onChange(next);
  };

  const step = (delta: number) => {
    const next = clamp(value + delta);
    onChange(next);
    setDraft(String(next));
  };

  const inputClass =
    "min-w-0 flex-1 rounded-xl border border-neutral-400/80 bg-neutral-200 px-2 py-2 text-center text-sm tabular-nums text-neutral-900 outline-none focus:border-accent-purple focus:ring-2 focus:ring-accent-purple/30 disabled:cursor-not-allowed";

  const stepClass =
    "flex w-10 shrink-0 items-center justify-center self-stretch rounded-xl border border-neutral-400/80 bg-neutral-100 text-lg font-semibold leading-none text-neutral-800 transition hover:bg-neutral-300 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div
      role="group"
      aria-label="Ticket count"
      className="flex min-h-[3.5rem] items-stretch gap-1"
    >
      <button
        type="button"
        className={stepClass}
        aria-label="Decrease tickets"
        disabled={disabled || value <= min}
        onClick={() => step(-1)}
      >
        −
      </button>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        aria-label="Number of tickets"
        disabled={disabled}
        value={draft}
        onFocus={() => setFocused(true)}
        onBlur={(e) => {
          setFocused(false);
          commitDraft(e.currentTarget.value);
        }}
        onChange={(e) => {
          const next = e.target.value.replace(/\D/g, "");
          setDraft(next);
          if (next === "") return;
          const n = parseInt(next, 10);
          if (Number.isFinite(n)) onChange(clamp(n));
        }}
        className={inputClass}
      />
      <button
        type="button"
        className={stepClass}
        aria-label="Increase tickets"
        disabled={disabled || value >= max}
        onClick={() => step(1)}
      >
        +
      </button>
    </div>
  );
}
