import type { LotteryCluster } from "@/lib/lottery/cluster";

/** Comma-separated `HELIUS_API_KEYS` or legacy single `HELIUS_API_KEY`. */
export function parseHeliusApiKeys(): string[] {
  const multi = process.env.HELIUS_API_KEYS?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (multi && multi.length > 0) return multi;
  const single = process.env.HELIUS_API_KEY?.trim();
  return single ? [single] : [];
}

export function heliusRpcUrl(cluster: LotteryCluster, apiKey: string): string {
  const host =
    cluster === "mainnet-beta"
      ? "mainnet.helius-rpc.com"
      : "devnet.helius-rpc.com";
  return `https://${host}/?api-key=${apiKey}`;
}

export function heliusJsonRpcUrl(apiKey: string): string {
  return `https://mainnet.helius-rpc.com/?api-key=${apiKey}`;
}
