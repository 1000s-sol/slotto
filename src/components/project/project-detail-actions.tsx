"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useCallback, useEffect, useState } from "react";

type LikeProps = {
  slug: string;
  initialLikes: number;
  className?: string;
  /** Smaller pill for directory tiles */
  variant?: "default" | "compact";
};

const likePillDefault =
  "inline-flex items-center gap-2 rounded-full border border-accent-gold/35 bg-bg-deep/55 px-3 py-1.5 text-sm text-accent-gold shadow-lg backdrop-blur-md transition hover:border-accent-gold/55 hover:bg-bg-deep/70 disabled:opacity-60";

const likePillCompact =
  "inline-flex items-center gap-1.5 rounded-full border border-accent-gold/35 bg-bg-deep/55 px-2 py-1 text-xs text-accent-gold shadow-md backdrop-blur-md transition hover:border-accent-gold/55 hover:bg-bg-deep/70 disabled:opacity-60";

export function ProjectLikePill({ slug, initialLikes, className = "", variant = "default" }: LikeProps) {
  const { connected, publicKey } = useWallet();
  const { setVisible } = useWalletModal();
  const [likes, setLikes] = useState(initialLikes);
  const [liked, setLiked] = useState(false);
  const [busy, setBusy] = useState(false);

  const wallet = publicKey?.toBase58() ?? null;

  const refresh = useCallback(async () => {
    const q = wallet ? `?wallet=${encodeURIComponent(wallet)}` : "";
    const res = await fetch(`/api/projects/${encodeURIComponent(slug)}/like${q}`, {
      cache: "no-store",
    });
    if (!res.ok) return;
    const json = (await res.json()) as { likes?: number; liked?: boolean };
    if (typeof json.likes === "number") setLikes(json.likes);
    setLiked(!!json.liked);
  }, [slug, wallet]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    setLikes(initialLikes);
  }, [initialLikes]);

  async function onLikeClick() {
    if (!connected || !publicKey) {
      setVisible(true);
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(slug)}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: publicKey.toBase58() }),
      });
      const json = (await res.json()) as { likes?: number; liked?: boolean };
      if (res.ok && typeof json.likes === "number") {
        setLikes(json.likes);
        setLiked(!!json.liked);
      }
    } finally {
      setBusy(false);
    }
  }

  const filled = connected && liked;

  const base = variant === "compact" ? likePillCompact : likePillDefault;

  return (
    <button
      type="button"
      onClick={() => void onLikeClick()}
      disabled={busy}
      className={`${base} ${className}`.trim()}
      aria-pressed={connected ? liked : undefined}
      aria-label={connected ? (liked ? "Unlike project" : "Like project") : "Connect wallet to like"}
    >
      <StarIcon filled={filled} compact={variant === "compact"} />
      <span className="min-w-[1ch] tabular-nums font-semibold text-accent-gold">{likes}</span>
    </button>
  );
}

type SocialProps = {
  websiteUrl: string | null;
  discordUrl: string | null;
  twitterUrl: string | null;
};

const iconBtn =
  "inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border/70 bg-surface/40 text-muted backdrop-blur-sm transition hover:border-accent-purple/40 hover:text-foreground";

export function ProjectSocialLinks({ websiteUrl, discordUrl, twitterUrl }: SocialProps) {
  if (!websiteUrl && !discordUrl && !twitterUrl) return null;

  return (
    <div className="flex shrink-0 flex-wrap justify-end gap-2">
      {websiteUrl ? (
        <a
          href={websiteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={iconBtn}
          aria-label="Website"
          title="Website"
        >
          <GlobeIcon className="h-5 w-5" />
        </a>
      ) : null}
      {discordUrl ? (
        <a
          href={discordUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={iconBtn}
          aria-label="Discord"
          title="Discord"
        >
          <DiscordIcon className="h-5 w-5" />
        </a>
      ) : null}
      {twitterUrl ? (
        <a
          href={twitterUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={iconBtn}
          aria-label="X"
          title="X"
        >
          <XIcon className="h-5 w-5" />
        </a>
      ) : null}
    </div>
  );
}

function StarIcon({ filled, compact }: { filled: boolean; compact?: boolean }) {
  const sz = compact ? "h-4 w-4" : "h-5 w-5";
  if (filled) {
    return (
      <svg className={`${sz} text-accent-gold`} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    );
  }
  return (
    <svg
      className={`${sz} text-accent-gold`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden
    >
      <path
        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 0 0 18M12 3a14 14 0 0 1 0 18" />
    </svg>
  );
}

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}
