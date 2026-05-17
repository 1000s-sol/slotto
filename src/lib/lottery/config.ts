import { PublicKey } from "@solana/web3.js";

const DEFAULT_PROGRAM_ID = "CiSuRzLSXbbbStNaDjjZbmSU8dn3zhx9qs3Nd9gvNYke";

export function lotteryProgramId(): PublicKey {
  const raw =
    process.env.NEXT_PUBLIC_SLOTTO_LOTTERY_PROGRAM_ID?.trim() ||
    DEFAULT_PROGRAM_ID;
  return new PublicKey(raw);
}

export function lotteryRpcUrl(): string | undefined {
  const url = process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.trim();
  return url || undefined;
}

export function solscanClusterParam(): string {
  const rpc = lotteryRpcUrl() ?? "";
  if (rpc.includes("devnet")) return "?cluster=devnet";
  if (rpc.includes("mainnet")) return "";
  return "?cluster=devnet";
}

export function solscanTxUrl(signature: string): string {
  return `https://solscan.io/tx/${signature}${solscanClusterParam()}`;
}

export function solscanAccountUrl(address: string): string {
  return `https://solscan.io/account/${address}${solscanClusterParam()}`;
}
