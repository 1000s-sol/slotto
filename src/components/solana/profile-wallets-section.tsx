"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useCallback, useEffect, useState } from "react";

import { WalletConnectButton } from "@/components/solana/wallet-connect-button";
import { buildProfileWalletVerifyMessage } from "@/lib/wallet-verify-message";

type Phase =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ok"; message?: string };

function shorten(address: string) {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

export function ProfileWalletsSection() {
  const { publicKey, connected, signMessage } = useWallet();
  const { setVisible } = useWalletModal();
  const address = publicKey?.toBase58();

  const [wallets, setWallets] = useState<string[]>([]);
  const [hasSocial, setHasSocial] = useState(false);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  const refresh = useCallback(async () => {
    const res = await fetch("/api/profile/me", { cache: "no-store" });
    const json = (await res.json()) as {
      canLike?: boolean;
      profile?: { wallets?: string[]; social?: { discord?: unknown; x?: unknown } } | null;
    };
    setWallets(json.profile?.wallets ?? []);
    setHasSocial(!!json.canLike);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const linkWallet = async (wallet: string) => {
    if (!hasSocial) {
      setPhase({
        kind: "error",
        message: "Connect Discord or X first — wallet linking requires a social login.",
      });
      return;
    }
    if (!signMessage) return;
    setPhase({ kind: "loading" });
    try {
      const message = buildProfileWalletVerifyMessage(wallet);
      const sig = await signMessage(new TextEncoder().encode(message));
      const bs58 = (await import("bs58")).default;
      const res = await fetch("/api/profile/wallet/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: wallet,
          message,
          signature: bs58.encode(sig),
        }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        reason?: string;
        merged?: boolean;
      };
      if (!json.ok) {
        setPhase({ kind: "error", message: json.reason ?? "Link failed" });
        return;
      }
      setPhase({
        kind: "ok",
        message: json.merged
          ? "Wallet linked — profiles merged."
          : "Wallet linked to your profile.",
      });
      await refresh();
    } catch (e) {
      setPhase({
        kind: "error",
        message: e instanceof Error ? e.message : "Link failed",
      });
    }
  };

  const unlinkWallet = async (wallet: string) => {
    setPhase({ kind: "loading" });
    try {
      const res = await fetch("/api/profile/wallet/unlink", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet }),
      });
      const json = (await res.json()) as { ok: boolean; reason?: string };
      if (!json.ok) {
        setPhase({ kind: "error", message: json.reason ?? "Unlink failed" });
        return;
      }
      setPhase({ kind: "ok", message: "Wallet removed." });
      await refresh();
    } catch (e) {
      setPhase({
        kind: "error",
        message: e instanceof Error ? e.message : "Unlink failed",
      });
    }
  };

  const adapterLinked = address && wallets.includes(address);

  return (
    <section className="rounded-2xl border border-border bg-bg-elevated/70 p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
        Linked wallets
      </h2>
      <p className="mt-2 text-sm text-muted">
        After connecting Discord or X, add Solana wallets to this profile. Tickets from
        every linked wallet appear in My tickets. Likes are tied to your social login —
        extra wallets cannot add more likes.
      </p>

      {!hasSocial ? (
        <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-950/20 px-3 py-2 text-sm text-amber-100">
          Connect Discord or X in Linked socials before linking a wallet.
        </p>
      ) : null}

      {wallets.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {wallets.map((w) => (
            <li
              key={w}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-surface/30 px-3 py-2"
            >
              <span className="font-mono text-xs text-foreground" title={w}>
                {shorten(w)}
              </span>
              <button
                type="button"
                disabled={phase.kind === "loading"}
                onClick={() => unlinkWallet(w)}
                className="text-xs text-red-400 hover:underline disabled:opacity-50"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-muted">No wallets linked yet.</p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <WalletConnectButton />
        {connected && address && !adapterLinked && hasSocial ? (
          <button
            type="button"
            disabled={!signMessage || phase.kind === "loading"}
            onClick={() => linkWallet(address)}
            className="rounded-lg border border-accent-purple/50 px-3 py-1.5 text-xs font-medium text-accent-purple disabled:opacity-50"
          >
            {phase.kind === "loading" ? "Signing…" : "Link this wallet"}
          </button>
        ) : null}
        {!connected && hasSocial ? (
          <button
            type="button"
            onClick={() => setVisible(true)}
            className="text-xs text-muted hover:text-foreground"
          >
            Connect a wallet to link it
          </button>
        ) : null}
      </div>

      {phase.kind === "error" ? (
        <p className="mt-3 text-sm text-red-400">{phase.message}</p>
      ) : null}
      {phase.kind === "ok" && phase.message ? (
        <p className="mt-3 text-sm text-accent-cyan">{phase.message}</p>
      ) : null}
    </section>
  );
}
