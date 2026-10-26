"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { signIn } from "next-auth/react";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";

import { DiscordLogo } from "@/components/discord-logo";
import { XLogo } from "@/components/x-logo";
import type { SocialProfile, WalletSocialPublic } from "@/lib/social-profile-url";

function shortenAddress(address: string) {
  if (address.length <= 12) return address;
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

type ProfileMe = {
  loggedIn: boolean;
  profile: {
    social: WalletSocialPublic;
  } | null;
};

function AccountAvatar({ profile, size = 28 }: { profile: SocialProfile; size?: number }) {
  const [failed, setFailed] = useState(false);
  const letter = profile.username.slice(0, 1).toUpperCase();

  if (!profile.avatarUrl || failed) {
    return (
      <span
        className="inline-flex shrink-0 items-center justify-center rounded-full bg-surface text-[10px] font-bold text-foreground ring-1 ring-border"
        style={{ width: size, height: size }}
      >
        {letter}
      </span>
    );
  }

  return (
    <img
      src={profile.avatarUrl}
      alt=""
      width={size}
      height={size}
      className="shrink-0 rounded-full object-cover ring-1 ring-white/30"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}

function StatusMark({ on }: { on: boolean }) {
  return (
    <span className={`text-[10px] font-semibold uppercase tracking-wide ${on ? "text-accent-cyan" : "text-muted"}`}>
      {on ? "Connected" : "Not connected"}
    </span>
  );
}

export function WalletConnectButton({
  variant = "default",
}: {
  /** Kept for existing call sites. Disconnect lives in the account menu. */
  variant?: "default" | "toolbar";
}) {
  void variant;
  const { publicKey, disconnect, connecting, connected } = useWallet();
  const { setVisible } = useWalletModal();
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [social, setSocial] = useState<WalletSocialPublic | null>(null);
  const [busy, setBusy] = useState<"discord" | "twitter" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/profile/me", { cache: "no-store" });
      const json = (await res.json()) as ProfileMe;
      setSocial(json.profile?.social ?? { discord: null, x: null });
    } catch {
      setSocial({ discord: null, x: null });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!open) return;
    void refresh();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onPointer);
    };
  }, [open, refresh]);

  const address = publicKey?.toBase58() ?? null;
  const face = social?.discord ?? social?.x ?? null;

  const label = useMemo(() => {
    if (connecting) return "Connecting…";
    if (connected && address) return shortenAddress(address);
    if (social?.discord) return social.discord.username;
    if (social?.x) return `@${social.x.username}`;
    return "Connect wallet";
  }, [address, connected, connecting, social]);

  const connectWallet = useCallback(() => {
    setOpen(false);
    setVisible(true);
  }, [setVisible]);

  const connectSocial = async (provider: "discord" | "twitter") => {
    setError(null);
    setBusy(provider);
    try {
      const callbackUrl = `${window.location.pathname}${window.location.search}`;
      await signIn(provider, { callbackUrl });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed");
      setBusy(null);
    }
  };

  const unlink = async (provider: "discord" | "twitter") => {
    setError(null);
    setBusy(provider);
    try {
      const res = await fetch("/api/profile/social/unlink", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      const json = (await res.json()) as { ok?: boolean; reason?: string };
      if (!json.ok) {
        setError(json.reason ?? "Could not disconnect");
        return;
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not disconnect");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        title={address ?? "Account"}
        disabled={connecting}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex max-w-full items-center gap-2 rounded-xl border border-border bg-surface/60 px-2.5 py-1.5 text-left shadow-sm transition hover:border-accent-purple/40 hover:bg-surface disabled:cursor-not-allowed disabled:opacity-60"
      >
        {face ? <AccountAvatar profile={face} /> : null}
        <span className={`truncate text-xs font-semibold ${connected ? "font-mono" : ""}`}>{label}</span>
        <span className="flex shrink-0 items-center gap-1.5" aria-hidden>
          <DiscordLogo size={14} className={social?.discord ? undefined : "opacity-35"} />
          <XLogo size={13} className={social?.x ? "text-foreground" : "text-muted opacity-35"} />
        </span>
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 z-[140] mt-2 w-[min(18rem,calc(100vw-2rem))] rounded-xl border border-border bg-bg-elevated p-3 text-left shadow-xl shadow-black/40"
        >
          <div className="border-b border-border/70 pb-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Wallet</p>
            {connected && address ? (
              <>
                <p className="mt-1 truncate font-mono text-xs text-foreground" title={address}>
                  {address}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-muted transition hover:text-foreground"
                    onClick={connectWallet}
                  >
                    Change wallet
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-muted transition hover:text-foreground"
                    onClick={() => {
                      disconnect().catch(() => undefined);
                      setOpen(false);
                    }}
                  >
                    Disconnect
                  </button>
                </div>
              </>
            ) : (
              <button
                type="button"
                className="mt-2 w-full rounded-lg bg-gradient-to-r from-accent-purple to-accent-blue px-3 py-2 text-sm font-semibold text-white"
                onClick={connectWallet}
              >
                {connecting ? "Connecting…" : "Connect wallet"}
              </button>
            )}
          </div>

          <SocialAccountRow
            name="Discord"
            profile={social?.discord ?? null}
            busy={busy === "discord"}
            icon={<DiscordLogo size={18} />}
            onConnect={() => void connectSocial("discord")}
            onDisconnect={() => void unlink("discord")}
          />
          <SocialAccountRow
            name="X"
            profile={social?.x ?? null}
            busy={busy === "twitter"}
            icon={<XLogo size={16} className="text-foreground" />}
            onConnect={() => void connectSocial("twitter")}
            onDisconnect={() => void unlink("twitter")}
          />

          {error ? <p className="mt-2 text-xs text-red-400">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function SocialAccountRow({
  name,
  profile,
  busy,
  icon,
  onConnect,
  onDisconnect,
}: {
  name: string;
  profile: SocialProfile | null;
  busy: boolean;
  icon: ReactNode;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  return (
    <div className="border-b border-border/70 py-3 last:border-b-0 last:pb-0">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
          {icon}
          {name}
        </span>
        <StatusMark on={!!profile} />
      </div>
      {profile ? (
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="inline-flex min-w-0 items-center gap-2">
            <AccountAvatar profile={profile} size={32} />
            <span className="truncate text-sm text-foreground">
              {name === "X" ? `@${profile.username}` : profile.username}
            </span>
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={onDisconnect}
            className="shrink-0 text-xs font-semibold text-muted hover:text-foreground disabled:opacity-50"
          >
            Disconnect
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={onConnect}
          className="mt-2 rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-foreground transition hover:border-accent-purple/40 disabled:opacity-50"
        >
          {busy ? "Connecting…" : `Connect ${name}`}
        </button>
      )}
    </div>
  );
}
