"use client";

import { signIn } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";

import { DiscordLogo } from "@/components/discord-logo";
import { XLogo } from "@/components/x-logo";
import { SocialProfileCell } from "@/components/social-profile-cell";
import type { WalletSocialPublic } from "@/lib/social-profile-url";

type Phase =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ok"; message?: string };

type ProfileMe = {
  loggedIn: boolean;
  profile: {
    id: string;
    social: WalletSocialPublic;
    wallets: string[];
  } | null;
};

export function ProfileSocialSection() {
  const [social, setSocial] = useState<WalletSocialPublic | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [oauthReady, setOauthReady] = useState<{
    discord: boolean;
    twitter: boolean;
    authSecret: boolean;
  } | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/profile/me", { cache: "no-store" });
    const json = (await res.json()) as ProfileMe;
    setLoggedIn(json.loggedIn);
    setSocial(json.profile?.social ?? { discord: null, x: null });
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    fetch("/api/auth/config", { cache: "no-store" })
      .then((r) => r.json())
      .then((json: { discord?: boolean; twitter?: boolean; authSecret?: boolean }) => {
        setOauthReady({
          discord: !!json.discord,
          twitter: !!json.twitter,
          authSecret: !!json.authSecret,
        });
      })
      .catch(() =>
        setOauthReady({ discord: false, twitter: false, authSecret: false }),
      );
  }, []);

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

  const connectOAuth = async (provider: "discord" | "twitter") => {
    if (!oauthReady?.authSecret) {
      setPhase({
        kind: "error",
        message: "AUTH_SECRET is not set on the server (Vercel env).",
      });
      return;
    }
    if (provider === "discord" && !oauthReady.discord) {
      setPhase({
        kind: "error",
        message: "Discord OAuth is not configured (AUTH_DISCORD_ID / SECRET).",
      });
      return;
    }
    if (provider === "twitter" && !oauthReady.twitter) {
      setPhase({
        kind: "error",
        message: "X OAuth is not configured (AUTH_TWITTER_ID / SECRET).",
      });
      return;
    }
    setPhase({ kind: "loading" });
    try {
      await signIn(provider, { callbackUrl: "/profile" });
    } catch (e) {
      setPhase({
        kind: "error",
        message: e instanceof Error ? e.message : "OAuth sign-in failed",
      });
    }
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

  return (
    <section className="rounded-2xl border border-border bg-bg-elevated/70 p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
        Linked socials
      </h2>
      <p className="mt-2 text-sm text-muted">
        Connect Discord and/or X to like projects and show on draw leaderboards. No wallet
        required.
      </p>

      <div className="mt-4 space-y-3 rounded-xl border border-border/80 bg-surface/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="sr-only">Discord</span>
          <DiscordLogo size={24} className="shrink-0" />
          {social?.discord ? (
            <div className="flex items-center gap-2">
              <SocialProfileCell profile={social.discord} size={32} />
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
              disabled={phase.kind === "loading" || oauthReady?.discord === false}
              onClick={() => connectOAuth("discord")}
              className="inline-flex items-center gap-2 rounded-lg bg-[#5865F2] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              aria-label="Connect Discord"
            >
              <DiscordLogo size={18} variant="white" className="shrink-0" />
              Connect
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
          <span className="sr-only">X</span>
          <XLogo size={24} className="shrink-0 text-foreground" />
          {social?.x ? (
            <div className="flex items-center gap-2">
              <SocialProfileCell profile={social.x} platform="x" size={32} />
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
              disabled={phase.kind === "loading" || oauthReady?.twitter === false}
              onClick={() => connectOAuth("twitter")}
              className="inline-flex items-center gap-2 rounded-lg bg-black px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              aria-label="Connect X"
            >
              <XLogo size={18} variant="white" className="shrink-0" />
              Connect
            </button>
          )}
        </div>
      </div>

      {!loggedIn && !social?.discord && !social?.x ? (
        <p className="mt-3 text-xs text-muted">
          Connect Discord or X above to sign in to your profile.
        </p>
      ) : null}

      {phase.kind === "error" ? (
        <p className="mt-3 text-sm text-red-400">{phase.message}</p>
      ) : null}
      {phase.kind === "ok" && phase.message ? (
        <p className="mt-3 text-sm text-accent-cyan">{phase.message}</p>
      ) : null}
    </section>
  );
}
