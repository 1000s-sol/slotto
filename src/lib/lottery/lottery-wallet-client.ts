import type { LotteryWalletSendOpts } from "./wallet-send-transaction";

/** Blockhash + confirm via server RPC (public Solana RPC 403s in the browser). */
export function lotteryWalletSendOptsFromApi(
  sendTransaction: LotteryWalletSendOpts["sendTransaction"],
): LotteryWalletSendOpts {
  return {
    sendTransaction,
    fetchBlockhash: async () => {
      const res = await fetch("/api/lottery/blockhash", { cache: "no-store" });
      if (!res.ok) {
        throw new Error("Could not fetch blockhash from server");
      }
      return res.json() as Promise<{
        blockhash: string;
        lastValidBlockHeight: number;
      }>;
    },
    confirmSignature: async (signature: string) => {
      const res = await fetch("/api/lottery/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signature }),
      });
      if (!res.ok) {
        return { confirmed: false, error: "Confirm request failed" };
      }
      return res.json() as Promise<{ confirmed: boolean; error: string | null }>;
    },
  };
}
