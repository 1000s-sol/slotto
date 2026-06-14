import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import type { Connection } from "@solana/web3.js";
import { PublicKey } from "@solana/web3.js";

import { isLotterySplBuySupportedProgram } from "./mint-token-program";

const TTL_MS = 7 * 24 * 60 * 60 * 1000;
const cache = new Map<string, { supported: boolean; exp: number }>();

/**
 * Force-show in the buy dropdown (admin can publish + unlock).
 * On-chain `buy_spl_tickets` still uses legacy SPL Token only — Token-2022 buys may fail.
 */
const LOTTERY_BUY_UI_OVERRIDE = new Set([
  "DEADsWJZaonaiZPFkrqEEBGf43mzA5uHeHpwgy9dW666",
]);

/** Token-2022 mints blocked from automatic RPC detection (unless in UI override). */
const KNOWN_UNSUPPORTED = new Set<string>();

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
    if (LOTTERY_BUY_UI_OVERRIDE.has(mint)) {
      out[mint] = true;
      toCache(mint, true);
      continue;
    }
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
    if (!info) {
      // RPC miss (rate limit / timeout) — do not cache false; keep buy UI usable.
      out[mint] = true;
      continue;
    }
    const supported =
      info.owner.equals(TOKEN_PROGRAM_ID) &&
      isLotterySplBuySupportedProgram(info.owner);
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
