"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { signIn } from "next-auth/react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { DiscordLogo } from "@/components/discord-logo";
import { XLogo } from "@/components/x-logo";
import type { SocialProfile, WalletSocialPublic } from "@/lib/social-profile-url";
import { buildWalletUnlinkMessage } from "@/lib/wallet-verify-message";

function shortenAddress(address: string) {
  if (address.length <= 12) return address;
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

type ProfileMe = {
  loggedIn: boolean;
  profile: {
    social: WalletSocialPublic;
    wallets?: string[];
  } | null;
};

type Cluster = {
  social: WalletSocialPublic | null;
  wallets: string[];
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

export function WalletConnectButton({
  variant = "default",
}: {
  /** Kept for existing call sites. Disconnect lives in the account menu. */
  variant?: "default" | "toolbar";
}) {
  void variant;
  const { publicKey, disconnect, connecting, connected, signMessage } = useWallet();
  const { setVisible } = useWalletModal();
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [social, setSocial] = useState<WalletSocialPublic | null>(null);
  const [linkedWallets, setLinkedWallets] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const address = publicKey?.toBase58() ?? null;

  const refresh = useCallback(async () => {
    try {
      const [meRes, clusterRes] = await Promise.all([
        fetch("/api/profile/me", { cache: "no-store" }),
        address
          ? fetch(`/api/profile/wallet/cluster?wallet=${encodeURIComponent(address)}`, {
              cache: "no-store",
            })
          : Promise.resolve(null),
      ]);
      const me = (await meRes.json()) as ProfileMe;
      const cluster = clusterRes ? ((await clusterRes.json()) as Cluster) : null;
      const walletSocial = cluster?.social;
      const walletHasLink = !!(walletSocial?.discord || walletSocial?.x || (cluster?.wallets.length ?? 0) > 0);
      if (walletHasLink && cluster) {
        setSocial(walletSocial ?? { discord: null, x: null });
        setLinkedWallets(cluster.wallets);
        return;
      }
      setSocial(me.profile?.social ?? { discord: null, x: null });
      setLinkedWallets(me.profile?.wallets ?? []);
    } catch {
      setSocial({ discord: null, x: null });
      setLinkedWallets([]);
    }
  }, [address]);

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

  const unlinkLinkedWallet = async (target: string) => {
    setError(null);
    setBusy(target);
    try {
      const send = async (extra?: { signer: string; message: string; signature: string }) => {
        const res = await fetch("/api/profile/wallet/unlink", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet: target, ...extra }),
        });
        return { res, json: (await res.json()) as { ok?: boolean; reason?: string } };
      };

      const first = await send();
      if (first.json.ok) {
        await refresh();
        return;
      }
      if (first.res.status === 401 && address && signMessage) {
        const message = buildWalletUnlinkMessage(address, target);
        const sig = await signMessage(new TextEncoder().encode(message));
        const bs58 = (await import("bs58")).default;
        const second = await send({
          signer: address,
          message,
          signature: bs58.encode(sig),
        });
        if (!second.json.ok) {
          setError(second.json.reason ?? "Could not unlink wallet");
          return;
        }
        await refresh();
        return;
      }
      setError(first.json.reason ?? "Could not unlink wallet");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not unlink wallet");
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
          <svg
            viewBox="0 0 20 20"
            className={`h-4 w-4 text-muted transition ${open ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 7.5 10 12.5 15 7.5" />
          </svg>
        </span>
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 z-[140] mt-2 w-[min(20rem,calc(100vw-1.5rem))] rounded-xl border border-border bg-[#120e22] p-3 text-left shadow-xl shadow-black/50"
        >
          {face ? (
            <div className="mb-3 flex items-center gap-3">
              <AccountAvatar profile={face} size={48} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">
                  {social?.discord?.username ?? `@${social?.x?.username}`}
                </p>
                {social?.discord && social.x ? (
                  <p className="truncate text-xs text-muted">@{social.x.username}</p>
                ) : (
                  <p className="text-xs text-muted">Linked to this wallet</p>
                )}
              </div>
            </div>
          ) : null}

          <div className="space-y-2">
            <SocialAccountRow
              name="Discord"
              profile={social?.discord ?? null}
              busy={busy === "discord"}
              tone="discord"
              onConnect={() => void connectSocial("discord")}
              onDisconnect={() => void unlink("discord")}
            />
            <SocialAccountRow
              name="X"
              profile={social?.x ?? null}
              busy={busy === "twitter"}
              tone="x"
              onConnect={() => void connectSocial("twitter")}
              onDisconnect={() => void unlink("twitter")}
            />
          </div>

          <div className="mt-3 border-t border-white/10 pt-3">
            <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-muted">
              <WalletGlyph />
              Wallets on this account
            </p>
            {linkedWallets.length > 0 ? (
              <ul className="mt-2 space-y-1.5">
                {linkedWallets.map((w) => (
                  <li
                    key={w}
                    className="flex items-center gap-2 rounded-lg bg-white/5 px-2 py-1.5"
                  >
                    <WalletGlyph />
                    <span className="min-w-0 flex-1 truncate font-mono text-xs text-white" title={w}>
                      {shortenAddress(w)}
                      {w === address ? (
                        <span className="ml-2 font-sans text-[10px] font-semibold uppercase tracking-wide text-accent-gold">
                          Connected
                        </span>
                      ) : null}
                    </span>
                    <button
                      type="button"
                      disabled={busy === w}
                      onClick={() => void unlinkLinkedWallet(w)}
                      className="shrink-0 text-[11px] font-semibold text-red-300 hover:text-red-200 disabled:opacity-50"
                    >
                      Unlink
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-muted">No wallets linked yet.</p>
            )}
            <div className="mt-3 flex gap-2">
              {connected && address ? (
                <>
                  <button
                    type="button"
                    className="flex-1 rounded-lg border border-white/15 px-2 py-1.5 text-xs font-semibold text-white/80 hover:bg-white/5"
                    onClick={connectWallet}
                  >
                    Change wallet
                  </button>
                  <button
                    type="button"
                    className="flex-1 rounded-lg border border-white/15 px-2 py-1.5 text-xs font-semibold text-white/80 hover:bg-white/5"
                    onClick={() => {
                      disconnect().catch(() => undefined);
                      setOpen(false);
                    }}
                  >
                    Disconnect
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="w-full rounded-lg bg-gradient-to-r from-accent-purple to-accent-blue px-3 py-2 text-sm font-semibold text-white"
                  onClick={connectWallet}
                >
                  {connecting ? "Connecting…" : "Connect wallet"}
                </button>
              )}
            </div>
          </div>

          {error ? <p className="mt-2 text-xs text-red-400">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function WalletGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-accent-gold" fill="none" aria-hidden>
      <rect x="3" y="6" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3 10h18" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="16.5" cy="14.5" r="1" fill="currentColor" />
    </svg>
  );
}

function SocialAccountRow({
  name,
  profile,
  busy,
  tone,
  onConnect,
  onDisconnect,
}: {
  name: string;
  profile: SocialProfile | null;
  busy: boolean;
  tone: "discord" | "x";
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  const label = profile ? (tone === "x" ? `@${profile.username}` : profile.username) : name;
  return (
    <div className="flex items-center gap-3 rounded-lg bg-white/5 px-2.5 py-2">
      <span
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${
          tone === "discord" ? "bg-[#5865F2]" : "bg-black ring-1 ring-white/20"
        }`}
      >
        {tone === "discord" ? (
          <DiscordLogo size={20} variant="white" />
        ) : (
          <XLogo size={16} variant="white" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          {profile ? <AccountAvatar profile={profile} size={22} /> : null}
          <span className="truncate text-sm font-semibold text-white">{label}</span>
        </span>
        <span className={`mt-0.5 block text-[10px] font-semibold uppercase tracking-wide ${profile ? "text-accent-cyan" : "text-muted"}`}>
          {profile ? "Connected" : "Not connected"}
        </span>
      </span>
      {profile ? (
        <button
          type="button"
          disabled={busy}
          onClick={onDisconnect}
          className="shrink-0 text-[11px] font-semibold text-muted hover:text-white disabled:opacity-50"
        >
          Disconnect
        </button>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={onConnect}
          className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-bg-deep disabled:opacity-50"
        >
          {busy ? "…" : "Connect"}
        </button>
      )}
    </div>
  );
}
