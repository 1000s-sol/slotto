"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useCallback, useMemo } from "react";

function shortenAddress(address: string) {
  if (address.length <= 12) return address;
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

export function WalletConnectButton({
  variant = "default",
}: {
  /** Hides Disconnect — use when Disconnect is offered elsewhere (e.g. mobile menu). */
  variant?: "default" | "toolbar";
}) {
  const { publicKey, disconnect, connecting, connected } = useWallet();
  const { setVisible } = useWalletModal();

  const openModal = useCallback(() => setVisible(true), [setVisible]);

  const label = useMemo(() => {
    if (connecting) return "Connecting…";
    if (connected && publicKey) return shortenAddress(publicKey.toBase58());
    return "Connect wallet";
  }, [connected, connecting, publicKey]);

  if (connected && publicKey) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          title={publicKey.toBase58()}
          className="rounded-xl border border-border bg-surface/60 px-4 py-2 font-mono text-xs font-semibold text-foreground shadow-sm transition hover:border-accent-purple/40 hover:bg-surface"
          onClick={openModal}
        >
          {label}
        </button>
        {variant === "default" ? (
          <button
            type="button"
            className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-muted transition hover:border-accent-purple/40 hover:text-foreground"
            onClick={() => disconnect().catch(() => undefined)}
          >
            Disconnect
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={connecting}
      onClick={openModal}
      className="rounded-xl bg-gradient-to-r from-accent-purple to-accent-blue px-4 py-2 text-sm font-semibold text-white shadow-md shadow-accent-purple/20 transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {label}
    </button>
  );
}
