import { PublicKey } from "@solana/web3.js";

export type TokenBalanceSnapshot = {
  amount: string;
  totalAmount: string;
  decimals: number;
  ata: string;
  lotteryBuySupported?: boolean;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Read SPL balance via server RPC (avoids browser api.mainnet-beta.solana.com 403). */
export async function fetchTokenBalanceClient(
  owner: PublicKey,
  mint: PublicKey,
): Promise<TokenBalanceSnapshot> {
  const params = new URLSearchParams({
    owner: owner.toBase58(),
    mint: mint.toBase58(),
  });

  let lastError = "Could not read token balance";
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const res = await fetch(`/api/lottery/token-balance?${params}`, {
      cache: "no-store",
    });
    const json = (await res.json()) as TokenBalanceSnapshot & { error?: string };
    if (res.ok) {
      return {
        ...json,
        totalAmount: json.totalAmount ?? json.amount,
      };
    }
    lastError = json.error ?? lastError;
    if (res.status === 429 && attempt < 2) {
      await sleep(600 * (attempt + 1));
      continue;
    }
    break;
  }
  throw new Error(lastError);
}
