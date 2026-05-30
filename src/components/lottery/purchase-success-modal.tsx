"use client";

import { useEffect, useId, useState } from "react";

import { solscanTxUrl } from "@/lib/lottery/config";

/** Public site origin (inlined at build via NEXT_PUBLIC_*). */
function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://slotto.gg";
}

export type PurchaseSuccessDetails = {
  count: number;
  /** Pretty ticket id range, e.g. "#5" or "#5–#8". */
  ticketIds: string;
  tokenSymbol: string;
  tokenName: string;
  tokenImageUrl: string | null;
  signature: string;
  /** Formatted live SOL jackpot (e.g. "0.019"), or null if unavailable. */
  jackpotSol: string | null;
};

function TokenAvatar({
  imageUrl,
  symbol,
}: {
  imageUrl: string | null;
  symbol: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [imageUrl]);
  const cls = "h-12 w-12 rounded-full object-cover ring-1 ring-border";
  if (imageUrl && !failed) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={imageUrl}
        alt={symbol}
        className={cls}
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
      className={`${cls} inline-flex items-center justify-center bg-surface text-base font-bold text-muted`}
      aria-hidden
    >
      {initial}
    </span>
  );
}

function buildTweetIntentUrl(details: PurchaseSuccessDetails): string {
  const ticketWord = details.count === 1 ? "ticket" : "tickets";
  const tokenPart = details.tokenSymbol ? ` with ${details.tokenSymbol}` : "";
  const jackpotPart = details.jackpotSol
    ? `\n\nLive jackpot: ${details.jackpotSol} SOL 💰`
    : "";
  const text =
    `I just grabbed ${details.count} ${ticketWord}${tokenPart} in the @slottogg_ draw 🎟️` +
    `${jackpotPart}\n\nThink you can win? Get your tickets:`;
  const params = new URLSearchParams({ text, url: siteUrl() });
  return `https://twitter.com/intent/tweet?${params.toString()}`;
}

export function PurchaseSuccessModal({
  open,
  onClose,
  details,
}: {
  open: boolean;
  onClose: () => void;
  details: PurchaseSuccessDetails | null;
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

  if (!open || !details) return null;

  const ticketWord = details.count === 1 ? "ticket" : "tickets";

  const onPostToX = () => {
    const url = buildTweetIntentUrl(details);
    window.open(url, "_blank", "noopener,noreferrer");
  };

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
        className="max-h-[min(90vh,720px)] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-bg-elevated shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h3 id={titleId} className="text-lg font-semibold text-foreground">
              You&apos;re in the draw! 🎟️
            </h3>
            <p className="mt-1 text-sm text-muted">
              Your tickets are confirmed on-chain.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-muted hover:bg-surface hover:text-foreground"
            aria-label="Close"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div className="flex items-center gap-3 rounded-xl border border-border bg-surface/40 p-4">
            <TokenAvatar
              imageUrl={details.tokenImageUrl}
              symbol={details.tokenSymbol}
            />
            <div className="min-w-0">
              <p className="text-base font-semibold text-foreground">
                {details.count} {ticketWord}{" "}
                <span className="text-muted">({details.ticketIds})</span>
              </p>
              <p className="mt-0.5 text-sm text-muted">
                Paid with{" "}
                <span className="font-medium text-foreground">
                  {details.tokenName}
                </span>
              </p>
            </div>
          </div>

          {details.jackpotSol ? (
            <div className="flex items-center justify-between rounded-xl border border-accent-gold/30 bg-accent-gold/10 px-4 py-3">
              <span className="text-sm text-muted">Live jackpot</span>
              <span className="font-mono text-lg font-bold text-accent-gold">
                {details.jackpotSol} SOL
              </span>
            </div>
          ) : null}

          <a
            href={solscanTxUrl(details.signature)}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 text-sm text-accent-cyan hover:underline"
          >
            View transaction on Solscan
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <path d="M15 3h6v6" />
              <path d="M10 14L21 3" />
            </svg>
          </a>
        </div>

        <div className="flex flex-col gap-2 border-t border-border px-5 py-4 sm:flex-row">
          <button
            type="button"
            onClick={onPostToX}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent-purple to-accent-blue px-4 py-2.5 text-sm font-semibold text-white"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
            </svg>
            Post on X
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted hover:text-foreground sm:flex-1"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
