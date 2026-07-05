import type { LotteryCluster } from "@/lib/lottery/cluster";

/** Comma-separated `HELIUS_API_KEYS` or legacy single `HELIUS_API_KEY`. */
export function parseHeliusApiKeys(): string[] {
  const multi = process.env.HELIUS_API_KEYS?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (multi && multi.length > 0) return multi;
  const single = process.env.HELIUS_API_KEY?.trim();
  const numbered: string[] = [];
  for (let i = 2; i <= 8; i += 1) {
    const k = process.env[`HELIUS_API_KEY_${i}`]?.trim();
    if (k) numbered.push(k);
  }
  const keys = single ? [single, ...numbered] : numbered;
  return [...new Set(keys)];
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
