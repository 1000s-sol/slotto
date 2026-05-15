"use client";

import { useState } from "react";

type Intent = "guest" | "listing";

export function ContactApplicationForm() {
  const [intent, setIntent] = useState<Intent>("guest");

  return (
    <form
      className="space-y-6 rounded-2xl border border-border bg-bg-elevated/70 p-6 sm:p-8"
      onSubmit={(e) => {
        e.preventDefault();
      }}
    >
      <div>
        <p className="text-sm font-medium text-foreground">I want to</p>
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <span
            className={`text-sm font-semibold transition ${intent === "guest" ? "text-foreground" : "text-muted"}`}
          >
            Guest spot on the X Space
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={intent === "listing"}
            aria-label="Toggle between guest spot and site listing application"
            onClick={() => setIntent((v) => (v === "guest" ? "listing" : "guest"))}
            className="relative h-9 w-16 shrink-0 self-center rounded-full border border-border bg-surface/80 transition hover:border-accent-purple/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-purple/50"
          >
            <span
              className={`absolute top-1 left-1 flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-accent-purple to-accent-blue text-[10px] font-bold text-white shadow-md transition-transform duration-200 ${
                intent === "listing" ? "translate-x-7" : "translate-x-0"
              }`}
            >
              {intent === "guest" ? "XS" : "Web"}
            </span>
          </button>
          <span
            className={`text-sm font-semibold transition ${intent === "listing" ? "text-foreground" : "text-muted"}`}
          >
            Listing on Slotto.gg
          </span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-foreground">Name</span>
          <input
            name="name"
            type="text"
            autoComplete="name"
            className="rounded-xl border border-border bg-surface/60 px-3 py-2.5 text-foreground outline-none focus:border-accent-purple/40 focus:ring-4 focus:ring-accent-purple/15"
            placeholder="Your name"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-foreground">Email</span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            className="rounded-xl border border-border bg-surface/60 px-3 py-2.5 text-foreground outline-none focus:border-accent-purple/40 focus:ring-4 focus:ring-accent-purple/15"
            placeholder="you@example.com"
          />
        </label>
      </div>

      {intent === "guest" ? (
        <div className="space-y-4">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-foreground">Project / org</span>
            <input
              name="guestProject"
              type="text"
              className="rounded-xl border border-border bg-surface/60 px-3 py-2.5 text-foreground outline-none focus:border-accent-purple/40 focus:ring-4 focus:ring-accent-purple/15"
              placeholder="What you would pitch on the space"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-foreground">X handle (optional)</span>
            <input
              name="guestX"
              type="text"
              className="rounded-xl border border-border bg-surface/60 px-3 py-2.5 text-foreground outline-none focus:border-accent-purple/40 focus:ring-4 focus:ring-accent-purple/15"
              placeholder="@yourproject"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-foreground">Why you&apos;d be a great guest</span>
            <textarea
              name="guestPitch"
              rows={5}
              className="resize-y rounded-xl border border-border bg-surface/60 px-3 py-2.5 text-foreground outline-none focus:border-accent-purple/40 focus:ring-4 focus:ring-accent-purple/15"
              placeholder="Topics, milestones, or stories you want to cover…"
            />
          </label>
        </div>
      ) : (
        <div className="space-y-4">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-foreground">Project name</span>
            <input
              name="listingName"
              type="text"
              className="rounded-xl border border-border bg-surface/60 px-3 py-2.5 text-foreground outline-none focus:border-accent-purple/40 focus:ring-4 focus:ring-accent-purple/15"
              placeholder="Official collection or brand name"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-foreground">Website</span>
            <input
              name="listingWebsite"
              type="url"
              className="rounded-xl border border-border bg-surface/60 px-3 py-2.5 text-foreground outline-none focus:border-accent-purple/40 focus:ring-4 focus:ring-accent-purple/15"
              placeholder="https://…"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-foreground">Magic Eden or primary marketplace link</span>
            <input
              name="listingMarketplace"
              type="url"
              className="rounded-xl border border-border bg-surface/60 px-3 py-2.5 text-foreground outline-none focus:border-accent-purple/40 focus:ring-4 focus:ring-accent-purple/15"
              placeholder="https://magiceden.io/…"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-foreground">What should the listing cover?</span>
            <textarea
              name="listingNotes"
              rows={5}
              className="resize-y rounded-xl border border-border bg-surface/60 px-3 py-2.5 text-foreground outline-none focus:border-accent-purple/40 focus:ring-4 focus:ring-accent-purple/15"
              placeholder="Utility, tokenomics, team, links we should verify…"
            />
          </label>
        </div>
      )}

      <input type="hidden" name="intent" value={intent} readOnly />

      <p className="text-xs text-muted">
        This form is a preview only — submissions are not stored yet. We&apos;ll wire it up after you
        sign off on fields.
      </p>

      <button
        type="submit"
        className="w-full rounded-xl bg-gradient-to-r from-accent-purple to-accent-blue px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-accent-purple/20 transition hover:opacity-95 sm:w-auto sm:px-8"
      >
        Submit (preview)
      </button>
    </form>
  );
}
