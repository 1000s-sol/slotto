import { PublicKey } from "@solana/web3.js";

const DEFAULT_PROGRAM_ID = "6mYYxtJ4NPH1oNJoy2CpJGQq6XiWCsu8iB5y6ior6TMq";

export function lotteryProgramId(): PublicKey {
  const raw =
    process.env.NEXT_PUBLIC_SLOTTO_LOTTERY_PROGRAM_ID?.trim() ||
    DEFAULT_PROGRAM_ID;
  try {
    return new PublicKey(raw);
  } catch {
    return new PublicKey(DEFAULT_PROGRAM_ID);
  }
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
