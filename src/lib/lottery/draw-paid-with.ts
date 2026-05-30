import { utils } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";

import { WRAPPED_SOL_MINT } from "@/lib/token-usd-prices";

import { drawPda } from "./pdas";

/** Anchor instruction discriminators (see idl/slotto_lottery.json). */
const BUY_SOL_DISC = [240, 15, 247, 138, 37, 98, 192, 250];
const BUY_SPL_DISC = [54, 1, 208, 36, 204, 54, 25, 1];

/** Account index of `buyer` and `mint` within each buy instruction (per IDL). */
const BUYER_IX_INDEX = 0;
const SPL_MINT_IX_INDEX = 3;

function discMatches(data: Uint8Array, disc: number[]): boolean {
  if (data.length < 8) return false;
  for (let i = 0; i < 8; i += 1) {
    if (data[i] !== disc[i]) return false;
  }
  return true;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor;
      cursor += 1;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

/**
 * Inspect the draw account's transaction history and attribute each buyer to
 * the set of mints they paid with (SOL is reported as wrapped-SOL mint).
 * The on-chain ticket data only stores owners, so this is the source of truth
 * for the "paid with" column. Best-effort: returns what it can decode.
 */
export async function fetchDrawPaidWithMints(
  connection: Connection,
  programId: PublicKey,
  drawId: number,
): Promise<Record<string, string[]>> {
  const draw = drawPda(programId, drawId);
  const pid58 = programId.toBase58();

  const signatures: string[] = [];
  let before: string | undefined;
  for (let page = 0; page < 20; page += 1) {
    const batch = await connection.getSignaturesForAddress(draw, {
      before,
      limit: 1000,
    });
    if (batch.length === 0) break;
    for (const b of batch) {
      if (!b.err) signatures.push(b.signature);
    }
    before = batch[batch.length - 1].signature;
    if (batch.length < 1000) break;
  }

  const walletMints = new Map<string, Set<string>>();
  const add = (wallet: string, mint: string) => {
    let set = walletMints.get(wallet);
    if (!set) {
      set = new Set();
      walletMints.set(wallet, set);
    }
    set.add(mint);
  };

  const txs = await mapWithConcurrency(signatures, 8, (sig) =>
    connection
      .getParsedTransaction(sig, { maxSupportedTransactionVersion: 0 })
      .catch(() => null),
  );

  for (const tx of txs) {
    if (!tx || tx.meta?.err) continue;
    for (const ix of tx.transaction.message.instructions) {
      if (ix.programId.toBase58() !== pid58) continue;
      if (!("data" in ix) || !("accounts" in ix)) continue;
      const data = utils.bytes.bs58.decode(ix.data);
      if (discMatches(data, BUY_SOL_DISC)) {
        const buyer = ix.accounts[BUYER_IX_INDEX]?.toBase58();
        if (buyer) add(buyer, WRAPPED_SOL_MINT);
      } else if (discMatches(data, BUY_SPL_DISC)) {
        const buyer = ix.accounts[BUYER_IX_INDEX]?.toBase58();
        const mint = ix.accounts[SPL_MINT_IX_INDEX]?.toBase58();
        if (buyer && mint) add(buyer, mint);
      }
    }
  }

  const out: Record<string, string[]> = {};
  for (const [wallet, set] of walletMints) {
    out[wallet] = [...set].sort((a, b) => {
      if (a === WRAPPED_SOL_MINT) return -1;
      if (b === WRAPPED_SOL_MINT) return 1;
      return a.localeCompare(b);
    });
  }
  return out;
}
