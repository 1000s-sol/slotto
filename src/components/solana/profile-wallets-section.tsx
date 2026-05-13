"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { WalletConnectButton } from "@/components/solana/wallet-connect-button";

export function ProfileWalletsSection() {
  const { publicKey, connected } = useWallet();

  return (
    <section className="rounded-2xl border border-border bg-bg-elevated/70 p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Linked wallets</h2>
      <p className="mt-3 text-sm text-muted">
        Connect the same wallet you use in the header. On-chain actions will request approval in your
        wallet extension.
      </p>
      {connected && publicKey ? (
        <p className="mt-4 break-all font-mono text-xs text-foreground">{publicKey.toBase58()}</p>
      ) : null}
      <div className="mt-4">
        <WalletConnectButton />
      </div>
    </section>
  );
}
