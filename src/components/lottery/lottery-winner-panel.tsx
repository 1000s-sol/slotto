"use client";

import { LotteryCelebration } from "@/components/lottery/lottery-celebration";
import { WalletAvatar } from "@/components/lottery/wallet-avatar";
import { SocialProfileCell } from "@/components/social-profile-cell";
import { solscanAccountUrl } from "@/lib/lottery/config";
import type { SocialProfile } from "@/lib/social-profile-url";

function shortenWallet(address: string) {
  if (address.length <= 12) return address;
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

function WinnerAvatar({
  wallet,
  discord,
  x,
}: {
  wallet: string;
  discord: SocialProfile | null | undefined;
  x: SocialProfile | null | undefined;
}) {
  const primary = discord ?? x;
  if (primary?.avatarUrl) {
    return (
      <img
        src={primary.avatarUrl}
        alt=""
        width={72}
        height={72}
        className="rounded-full object-cover ring-2 ring-accent-gold/50"
        referrerPolicy="no-referrer"
      />
    );
  }
  return <WalletAvatar address={wallet} size={72} />;
}

export function LotteryWinnerPanel({
  wallet,
  discord,
  x,
  prizeSol,
  drawId,
  winningTicketId,
}: {
  wallet: string;
  discord?: SocialProfile | null;
  x?: SocialProfile | null;
  prizeSol: string;
  drawId: number;
  winningTicketId?: number | null;
}) {
  const displayName = discord?.username ?? x?.username ?? null;

  return (
    <div className="relative flex flex-col items-center overflow-hidden rounded-2xl border border-border bg-bg-elevated/70 p-6 text-center">
      <LotteryCelebration />
      <div className="relative z-10 flex flex-col items-center">
        <div className="text-xs font-semibold uppercase tracking-[0.25em] text-accent-gold">
          Winner
        </div>
        <div className="mt-4">
          <WinnerAvatar wallet={wallet} discord={discord} x={x} />
        </div>
        {displayName ? (
          <p className="mt-3 max-w-[240px] truncate text-lg font-semibold text-foreground">
            {displayName}
          </p>
        ) : null}
        {(discord || x) ? (
          <div className="mt-3 flex flex-wrap items-center justify-center gap-3 text-sm">
            {discord ? (
              <SocialProfileCell profile={discord} platform="discord" size={28} />
            ) : null}
            {x ? <SocialProfileCell profile={x} platform="x" size={28} /> : null}
          </div>
        ) : null}
        <a
          href={solscanAccountUrl(wallet)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 font-mono text-xs text-muted hover:text-accent-cyan"
          title={wallet}
        >
          {shortenWallet(wallet)}
        </a>
        <div className="mt-4 text-4xl font-black leading-none tracking-tight text-accent-gold [font-family:var(--font-zen-dots),var(--font-michroma),sans-serif] sm:text-5xl">
          {prizeSol}
        </div>
        <div className="mt-1 text-sm text-muted">SOL won</div>
        <p className="mt-4 text-center text-xs text-muted">
          Draw #{drawId}
          {winningTicketId != null && winningTicketId > 0
            ? ` · winning ticket #${winningTicketId}`
            : null}
        </p>
      </div>
    </div>
  );
}
