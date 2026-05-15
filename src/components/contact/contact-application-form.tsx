"use client";

import { useState } from "react";

type Intent = "guest" | "listing";

export function ContactApplicationForm({ className = "" }: { className?: string }) {
  const [intent, setIntent] = useState<Intent>("guest");

  return (
    <form
      className={`flex min-h-0 flex-1 flex-col gap-6 rounded-2xl border border-border bg-bg-elevated/70 p-6 sm:p-8 ${className}`}
      onSubmit={(e) => {
        e.preventDefault();
      }}
    >
      <div
        role="tablist"
        aria-label="Application type"
        className="inline-flex w-full max-w-md rounded-xl border border-border bg-surface/40 p-1 text-xs font-semibold sm:text-sm"
      >
        <button
          type="button"
          role="tab"
          aria-selected={intent === "guest"}
          onClick={() => setIntent("guest")}
          className={`min-w-0 flex-1 rounded-lg px-2 py-2 transition sm:px-4 sm:py-2 ${
            intent === "guest"
              ? "bg-gradient-to-r from-accent-purple to-accent-blue text-white shadow-md shadow-accent-purple/25"
              : "text-muted hover:text-foreground"
          }`}
        >
          Guest spot on X Space
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={intent === "listing"}
          onClick={() => setIntent("listing")}
          className={`min-w-0 flex-1 rounded-lg px-2 py-2 transition sm:px-4 sm:py-2 ${
            intent === "listing"
              ? "bg-gradient-to-r from-accent-purple to-accent-blue text-white shadow-md shadow-accent-purple/25"
              : "text-muted hover:text-foreground"
          }`}
        >
          Listing on Slotto.gg
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-6">
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
                className="min-h-[8rem] resize-y rounded-xl border border-border bg-surface/60 px-3 py-2.5 text-foreground outline-none focus:border-accent-purple/40 focus:ring-4 focus:ring-accent-purple/15"
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
                className="min-h-[8rem] resize-y rounded-xl border border-border bg-surface/60 px-3 py-2.5 text-foreground outline-none focus:border-accent-purple/40 focus:ring-4 focus:ring-accent-purple/15"
                placeholder="Utility, tokenomics, team, links we should verify…"
              />
            </label>
          </div>
        )}

        <input type="hidden" name="intent" value={intent} readOnly />
      </div>

      <div className="mt-auto border-t border-border/60 pt-4">
        <button
          type="submit"
          className="w-full rounded-xl bg-gradient-to-r from-accent-purple to-accent-blue px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-accent-purple/20 transition hover:opacity-95 sm:w-auto sm:px-8"
        >
          Submit
        </button>
      </div>
    </form>
  );
}
