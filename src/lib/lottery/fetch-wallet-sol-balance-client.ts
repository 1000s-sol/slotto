import { PublicKey } from "@solana/web3.js";

export async function fetchWalletSolBalanceClient(
  owner: PublicKey,
): Promise<number> {
  const params = new URLSearchParams({ owner: owner.toBase58() });
  const res = await fetch(`/api/lottery/sol-balance?${params}`, {
    cache: "no-store",
  });
  const json = (await res.json()) as { lamports?: number; error?: string };
  if (!res.ok) {
    throw new Error(json.error ?? "Could not read SOL balance");
  }
  return json.lamports ?? 0;
}
