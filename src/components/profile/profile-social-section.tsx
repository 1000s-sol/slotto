"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { signIn } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";

import {
  DiscordProfileTag,
  XProfileTag,
} from "@/components/social-profile-tags";
import type { WalletSocialPublic } from "@/lib/social-profile-url";
import { buildProfileWalletVerifyMessage } from "@/lib/wallet-verify-message";

type Phase =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ok"; message?: string };

export function ProfileSocialSection() {
  const { connected, publicKey, signMessage } = useWallet();
  const { setVisible } = useWalletModal();
  const address = publicKey?.toBase58();

  const [verifiedWallet, setVerifiedWallet] = useState<string | null>(null);
  const [social, setSocial] = useState<WalletSocialPublic | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  const refresh = useCallback(async () => {
    if (!address) {
      setVerifiedWallet(null);
      setSocial(null);
      return;
    }
    const res = await fetch(
      `/api/profile/wallet/status?wallet=${encodeURIComponent(address)}`,
      { cache: "no-store" },
    );
    const json = (await res.json()) as {
      verified: boolean;
      wallet?: string;
      social?: WalletSocialPublic | null;
    };
    if (json.verified && json.wallet === address) {
      setVerifiedWallet(json.wallet);
      setSocial(json.social ?? { discord: null, xHandle: null });
    } else {
      setVerifiedWallet(null);
      setSocial(null);
    }
  }, [address]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const linked = params.get("linked");
    const error = params.get("error");
    if (linked) {
      setPhase({ kind: "ok", message: `${linked === "twitter" ? "X" : "Discord"} connected.` });
      params.delete("linked");
      params.delete("error");
      const q = params.toString();
      window.history.replaceState({}, "", q ? `?${q}` : "/profile");
      void refresh();
    } else if (error) {
      setPhase({
        kind: "error",
        message: decodeURIComponent(error).replace(/_/g, " "),
      });
      params.delete("error");
      params.delete("linked");
      const q = params.toString();
      window.history.replaceState({}, "", q ? `?${q}` : "/profile");
    }
  }, [refresh]);

  const verifyWallet = async () => {
    if (!address || !signMessage) return;
    setPhase({ kind: "loading" });
    try {
      const message = buildProfileWalletVerifyMessage(address);
      const sig = await signMessage(new TextEncoder().encode(message));
      const bs58 = (await import("bs58")).default;
      const res = await fetch("/api/profile/wallet/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address,
          message,
          signature: bs58.encode(sig),
        }),
      });
      const json = (await res.json()) as { ok: boolean; reason?: string };
      if (!json.ok) {
        setPhase({ kind: "error", message: json.reason ?? "Verification failed" });
        return;
      }
      setPhase({ kind: "ok", message: "Wallet verified. You can connect Discord or X." });
      await refresh();
    } catch (e) {
      setPhase({
        kind: "error",
        message: e instanceof Error ? e.message : "Verification failed",
      });
    }
  };

  const connectOAuth = async (provider: "discord" | "twitter") => {
    if (!verifiedWallet || verifiedWallet !== address) {
      setPhase({ kind: "error", message: "Verify your wallet first." });
      return;
    }
    setPhase({ kind: "loading" });
    await signIn(provider, { callbackUrl: "/profile" });
  };

  const unlink = async (provider: "discord" | "twitter") => {
    setPhase({ kind: "loading" });
    try {
      const res = await fetch("/api/profile/social/unlink", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      const json = (await res.json()) as { ok: boolean; reason?: string };
      if (!json.ok) {
        setPhase({ kind: "error", message: json.reason ?? "Unlink failed" });
        return;
      }
      setPhase({ kind: "ok", message: "Disconnected." });
      await refresh();
    } catch (e) {
      setPhase({
        kind: "error",
        message: e instanceof Error ? e.message : "Unlink failed",
      });
    }
  };

  const walletReady = connected && address;
  const verified = verifiedWallet === address;

  return (
    <section className="rounded-2xl border border-border bg-bg-elevated/70 p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
        Linked socials
      </h2>
      <p className="mt-2 text-sm text-muted">
        Connect Discord and X to show on draw leaderboards and winner cards. Your wallet
        must sign once to prove ownership before OAuth.
      </p>

      {!walletReady ? (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setVisible(true)}
            className="rounded-xl bg-gradient-to-r from-accent-purple to-accent-blue px-4 py-2.5 text-sm font-semibold text-white"
          >
            Connect wallet
          </button>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {!verified ? (
            <button
              type="button"
              disabled={!signMessage || phase.kind === "loading"}
              onClick={() => verifyWallet()}
              className="rounded-lg border border-accent-purple/50 px-4 py-2 text-sm font-medium text-accent-purple disabled:opacity-50"
            >
              {phase.kind === "loading" ? "Signing…" : "Verify wallet to link socials"}
            </button>
          ) : (
            <p className="text-xs text-muted">
              Wallet verified{" "}
              <span className="font-mono text-foreground">
                {address.slice(0, 4)}…{address.slice(-4)}
              </span>
            </p>
          )}

          <div className="space-y-3 rounded-xl border border-border/80 bg-surface/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-foreground">Discord</span>
              {social?.discord ? (
                <div className="flex items-center gap-2">
                  <DiscordProfileTag discord={social.discord} />
                  <button
                    type="button"
                    disabled={phase.kind === "loading"}
                    onClick={() => unlink("discord")}
                    className="text-xs text-red-400 hover:underline disabled:opacity-50"
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={!verified || phase.kind === "loading"}
                  onClick={() => connectOAuth("discord")}
                  className="rounded-lg bg-[#5865F2] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  Connect Discord
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
              <span className="text-sm font-medium text-foreground">X</span>
              {social?.xHandle ? (
                <div className="flex items-center gap-2">
                  <XProfileTag handle={social.xHandle} />
                  <button
                    type="button"
                    disabled={phase.kind === "loading"}
                    onClick={() => unlink("twitter")}
                    className="text-xs text-red-400 hover:underline disabled:opacity-50"
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={!verified || phase.kind === "loading"}
                  onClick={() => connectOAuth("twitter")}
                  className="rounded-lg bg-foreground px-3 py-1.5 text-xs font-semibold text-background disabled:opacity-50"
                >
                  Connect X
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {phase.kind === "error" ? (
        <p className="mt-3 text-sm text-red-400">{phase.message}</p>
      ) : null}
      {phase.kind === "ok" && phase.message ? (
        <p className="mt-3 text-sm text-accent-cyan">{phase.message}</p>
      ) : null}
    </section>
  );
}
