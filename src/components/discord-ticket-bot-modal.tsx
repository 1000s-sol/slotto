"use client";

import { useEffect, useId, useState } from "react";

import { DiscordLogo } from "@/components/discord-logo";

export function DiscordTicketBotButton() {
  const [open, setOpen] = useState(false);
  const titleId = useId();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl border border-[#5865F2]/50 bg-[#5865F2]/15 px-5 py-2.5 text-sm font-medium text-foreground transition hover:bg-[#5865F2]/25"
      >
        <DiscordLogo className="h-5 w-5 text-[#5865F2]" />
        Sales Bot
      </button>
      <DiscordTicketBotModal
        open={open}
        onClose={() => setOpen(false)}
        titleId={titleId}
      />
    </>
  );
}

function DiscordTicketBotModal({
  open,
  onClose,
  titleId,
}: {
  open: boolean;
  onClose: () => void;
  titleId: string;
}) {
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setInviteUrl(null);
    setInviteError(false);
    fetch("/api/discord/bot-invite")
      .then(async (res) => {
        if (!res.ok) throw new Error("not configured");
        const data = (await res.json()) as { inviteUrl?: string };
        if (!cancelled && data.inviteUrl) setInviteUrl(data.inviteUrl);
      })
      .catch(() => {
        if (!cancelled) setInviteError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

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
      className="fixed inset-0 z-[110] flex min-h-[100dvh] items-center justify-center bg-black/60 p-4 backdrop-blur-sm md:bg-black/75 md:backdrop-blur-md"
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
          <div className="flex items-center gap-3">
            <DiscordLogo className="h-8 w-8 shrink-0 text-[#5865F2]" />
            <div>
              <h3 id={titleId} className="text-lg font-semibold text-foreground">
                Slotto ticket alerts on Discord
              </h3>
              <p className="mt-1 text-sm text-muted">
                Post an embed in your server whenever someone buys tickets on slotto.gg.
              </p>
            </div>
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

        <div className="space-y-4 px-5 py-5 text-sm leading-relaxed text-muted">
          <ol className="list-decimal space-y-3 pl-5">
            <li>
              <span className="text-foreground">You need Administrator or Manage Server</span>{" "}
              on the Discord server you want to connect.
            </li>
            <li>
              Invite the Slotto bot using the button below (opens Discord in a new tab).
            </li>
            <li>
              In your server, run{" "}
              <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-xs text-foreground">
                /slotto-setup
              </code>{" "}
              and pick the text channel for announcements.
            </li>
          </ol>

          <div className="rounded-xl border border-border bg-surface/40 p-4">
            <p className="font-medium text-foreground">Permissions in that channel</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>View Channel</li>
              <li>Send Messages</li>
              <li>Embed Links</li>
            </ul>
            <p className="mt-2 text-xs">
              The bot only posts purchase embeds; it does not read your messages or manage roles.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-border px-5 py-4 sm:flex-row">
          {inviteUrl ? (
            <a
              href={inviteUrl}
              target="_blank"
              rel="noreferrer"
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#5865F2] px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110"
            >
              <DiscordLogo className="h-4 w-4 shrink-0" variant="white" />
              invite bot
            </a>
          ) : inviteError ? (
            <p className="flex-1 text-sm text-amber-200/90">
              Bot invite unavailable. Ensure{" "}
              <code className="font-mono text-xs">AUTH_DISCORD_ID</code> and{" "}
              <code className="font-mono text-xs">DISCORD_BOT_TOKEN</code> are set on the server.
            </p>
          ) : (
            <p className="flex-1 text-sm text-muted">Loading invite link…</p>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted hover:text-foreground sm:flex-1"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
