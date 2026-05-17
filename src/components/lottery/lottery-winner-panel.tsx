"use client";

import { LotteryCelebration } from "@/components/lottery/lottery-celebration";
import { WalletAvatar } from "@/components/lottery/wallet-avatar";
import { solscanAccountUrl } from "@/lib/lottery/config";

function shortenWallet(address: string) {
  if (address.length <= 12) return address;
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

export function LotteryWinnerPanel({
  wallet,
  xHandle,
  prizeSol,
  drawId,
  winningTicketId,
}: {
  wallet: string;
  xHandle?: string | null;
  prizeSol: string;
  drawId: number;
  winningTicketId?: number | null;
}) {
  return (
    <div className="relative flex flex-col items-center overflow-hidden rounded-2xl border border-border bg-bg-elevated/70 p-6 text-center">
      <LotteryCelebration />
      <div className="relative z-10 flex flex-col items-center">
        <div className="text-xs font-semibold uppercase tracking-[0.25em] text-accent-gold">
          Winner
        </div>
        <div className="mt-4">
          <WalletAvatar address={wallet} size={72} />
        </div>
        {xHandle ? (
          <a
            href={`https://x.com/${xHandle}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 text-sm font-semibold text-accent-cyan hover:underline"
          >
            @{xHandle}
          </a>
        ) : null}
        <a
          href={solscanAccountUrl(wallet)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 font-mono text-sm text-foreground hover:text-accent-cyan"
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
