import { PublicKey } from "@solana/web3.js";

export type TokenBalanceSnapshot = {
  amount: string;
  totalAmount: string;
  decimals: number;
  ata: string;
};

/** Read SPL balance via server RPC (avoids browser api.mainnet-beta.solana.com 403). */
export async function fetchTokenBalanceClient(
  owner: PublicKey,
  mint: PublicKey,
): Promise<TokenBalanceSnapshot> {
  const params = new URLSearchParams({
    owner: owner.toBase58(),
    mint: mint.toBase58(),
  });
  const res = await fetch(`/api/lottery/token-balance?${params}`, {
    cache: "no-store",
  });
  const json = (await res.json()) as TokenBalanceSnapshot & { error?: string };
  if (!res.ok) {
    throw new Error(json.error ?? "Could not read token balance");
  }
  return {
    ...json,
    totalAmount: json.totalAmount ?? json.amount,
  };
}
