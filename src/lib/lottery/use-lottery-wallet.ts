"use client";

import type { AnchorWallet } from "@solana/wallet-adapter-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useMemo } from "react";

/**
 * Wallet adapter signing surface for lottery txs. Prefer over `useAnchorWallet()`
 * so Wallet Standard / Phantom always expose signTransaction when connected.
 */
export function useLotteryWallet(): AnchorWallet | undefined {
  const { publicKey, signTransaction, signAllTransactions } = useWallet();
  return useMemo(() => {
    if (!publicKey || !signTransaction || !signAllTransactions) {
      return undefined;
    }
    return { publicKey, signTransaction, signAllTransactions };
  }, [publicKey, signTransaction, signAllTransactions]);
}
