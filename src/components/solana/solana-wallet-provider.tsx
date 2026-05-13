"use client";

import { Buffer } from "buffer";
import { clusterApiUrl } from "@solana/web3.js";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { useMemo, type ReactNode } from "react";

import "@solana/wallet-adapter-react-ui/styles.css";

if (typeof globalThis !== "undefined" && !(globalThis as unknown as { Buffer?: unknown }).Buffer) {
  (globalThis as unknown as { Buffer: typeof Buffer }).Buffer = Buffer;
}

function rpcEndpoint() {
  const fromEnv = process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.trim();
  if (fromEnv) return fromEnv;
  return clusterApiUrl("mainnet-beta");
}

type Props = { children: ReactNode };

export function SolanaWalletProvider({ children }: Props) {
  const endpoint = useMemo(() => rpcEndpoint(), []);
  // Phantom / Solflare register via Wallet Standard; extra adapters are redundant and can break
  // the modal → connect flow. Empty list = standard wallets only.
  const wallets = useMemo(() => [], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      {/* autoConnect triggers connect() after modal select; false leaves wallet selected but never connects */}
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
