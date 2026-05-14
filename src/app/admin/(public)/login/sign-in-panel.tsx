"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import bs58 from "bs58";
import { useCallback, useEffect, useMemo, useState } from "react";

type Phase =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "ready"; isAdmin: boolean }
  | { kind: "signing" }
  | { kind: "verifying" }
  | { kind: "error"; message: string };

type ChallengeRes = {
  ok: boolean;
  message?: string;
  nonce?: string;
  exp?: number;
  sig?: string;
  reason?: string;
};

export function AdminSignInPanel({ nextPath }: { nextPath: string }) {
  const { connected, publicKey, signMessage, wallet } = useWallet();
  const { setVisible } = useWalletModal();
  const address = publicKey?.toBase58();
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  useEffect(() => {
    let cancelled = false;
    if (!address) {
      setPhase({ kind: "idle" });
      return;
    }
    setPhase({ kind: "checking" });
    (async () => {
      try {
        const res = await fetch(`/api/admin/is-admin?address=${encodeURIComponent(address)}`, {
          cache: "no-store",
        });
        const json = (await res.json()) as { ok: boolean };
        if (cancelled) return;
        setPhase({ kind: "ready", isAdmin: !!json.ok });
      } catch {
        if (cancelled) return;
        setPhase({ kind: "error", message: "Could not check admin status." });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [address]);

  const onSignIn = useCallback(async () => {
    if (!address || !signMessage) return;
    setPhase({ kind: "signing" });
    try {
      const challengeRes = await fetch(
        `/api/admin/challenge?address=${encodeURIComponent(address)}`,
        { cache: "no-store" },
      );
      const challenge = (await challengeRes.json()) as ChallengeRes;
      if (!challenge.ok || !challenge.message || !challenge.sig || !challenge.exp) {
        setPhase({ kind: "error", message: challenge.reason ?? "Could not get challenge." });
        return;
      }

      const signature = await signMessage(new TextEncoder().encode(challenge.message));
      setPhase({ kind: "verifying" });

      const loginRes = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address,
          message: challenge.message,
          signature: bs58.encode(signature),
          exp: challenge.exp,
          sig: challenge.sig,
        }),
      });
      const json = (await loginRes.json()) as { ok: boolean; reason?: string };
      if (!loginRes.ok || !json.ok) {
        setPhase({
          kind: "error",
          message: json.reason ?? `Sign-in failed (HTTP ${loginRes.status}).`,
        });
        return;
      }
      window.location.assign(nextPath);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Sign-in cancelled.";
      setPhase({ kind: "error", message });
    }
  }, [address, nextPath, signMessage]);

  const canSign = useMemo(
    () => connected && !!address && !!signMessage && phase.kind === "ready" && phase.isAdmin,
    [address, connected, phase, signMessage],
  );

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-bg-elevated/70 p-6">
      {!connected || !address ? (
        <>
          <p className="text-sm text-muted">Connect your admin wallet to begin.</p>
          <button
            type="button"
            onClick={() => setVisible(true)}
            className="w-full rounded-xl bg-gradient-to-r from-accent-purple to-accent-blue px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent-purple/20"
          >
            Connect wallet
          </button>
        </>
      ) : (
        <>
          <div className="text-xs text-muted">
            Connected with{" "}
            <span title={address} className="font-mono text-foreground">
              {address.slice(0, 4)}…{address.slice(-4)}
            </span>{" "}
            via {wallet?.adapter.name ?? "wallet"}.
          </div>

          {phase.kind === "checking" ? (
            <div className="text-sm text-muted">Checking allowlist…</div>
          ) : phase.kind === "ready" && !phase.isAdmin ? (
            <div className="rounded-xl border border-red-500/30 bg-red-950/25 px-3 py-2 text-sm text-red-200">
              This wallet is not in the admin allowlist.
            </div>
          ) : null}

          {!signMessage ? (
            <div className="rounded-xl border border-accent-gold/40 bg-surface/60 px-3 py-2 text-sm text-muted">
              This wallet does not expose <span className="font-mono">signMessage</span>. Try Phantom
              or Solflare.
            </div>
          ) : null}

          <button
            type="button"
            disabled={!canSign || phase.kind === "signing" || phase.kind === "verifying"}
            onClick={onSignIn}
            className="w-full rounded-xl bg-gradient-to-r from-accent-purple to-accent-blue px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent-purple/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {phase.kind === "signing"
              ? "Approve in wallet…"
              : phase.kind === "verifying"
                ? "Verifying…"
                : "Sign in to admin"}
          </button>

          {phase.kind === "error" ? (
            <div className="rounded-xl border border-red-500/40 bg-red-950/30 px-3 py-2 text-sm text-red-200">
              {phase.message}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
