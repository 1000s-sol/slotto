import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import type { Connection } from "@solana/web3.js";
import { PublicKey } from "@solana/web3.js";

import { isLotterySplBuySupportedProgram } from "./mint-token-program";

const TTL_MS = 7 * 24 * 60 * 60 * 1000;
const cache = new Map<string, { supported: boolean; exp: number }>();

/** Token-2022 mints on draws — lottery program cannot buy these yet. */
const KNOWN_UNSUPPORTED = new Set([
  "DEADsWJZaonaiZPFkrqEEBGf43mzA5uHeHpwgy9dW666",
]);

function fromCache(mint: string): boolean | undefined {
  const row = cache.get(mint);
  if (!row || row.exp < Date.now()) {
    cache.delete(mint);
    return undefined;
  }
  return row.supported;
}

function toCache(mint: string, supported: boolean): void {
  cache.set(mint, { supported, exp: Date.now() + TTL_MS });
}

/** Whether mint can be used for on-chain SPL ticket buys (cached, batched RPC). */
export async function batchMintLotteryBuySupported(
  connection: Connection,
  mints: string[],
): Promise<Record<string, boolean>> {
  const out: Record<string, boolean> = {};
  const pending: string[] = [];

  for (const mint of mints) {
    if (KNOWN_UNSUPPORTED.has(mint)) {
      out[mint] = false;
      toCache(mint, false);
      continue;
    }
    const hit = fromCache(mint);
    if (hit !== undefined) {
      out[mint] = hit;
    } else {
      pending.push(mint);
    }
  }

  if (pending.length === 0) return out;

  const keys = pending.map((m) => new PublicKey(m));
  const infos = await connection.getMultipleAccountsInfo(keys, "confirmed");

  for (let i = 0; i < pending.length; i += 1) {
    const mint = pending[i]!;
    const info = infos[i];
    let supported = false;
    if (info) {
      supported =
        info.owner.equals(TOKEN_PROGRAM_ID) &&
        isLotterySplBuySupportedProgram(info.owner);
    }
    toCache(mint, supported);
    out[mint] = supported;
  }

  return out;
}

export async function mintLotteryBuySupportedCached(
  connection: Connection,
  mint: PublicKey,
): Promise<boolean> {
  const map = await batchMintLotteryBuySupported(connection, [mint.toBase58()]);
  return map[mint.toBase58()] ?? false;
}
