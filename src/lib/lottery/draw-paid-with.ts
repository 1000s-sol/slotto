import { utils } from "@coral-xyz/anchor";
import {
  Connection,
  PublicKey,
  type PartiallyDecodedInstruction,
  type ParsedTransactionWithMeta,
  type VersionedTransactionResponse,
} from "@solana/web3.js";

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

function isPartiallyDecoded(
  ix: unknown,
): ix is PartiallyDecodedInstruction {
  return (
    typeof ix === "object" &&
    ix !== null &&
    "programId" in ix &&
    "accounts" in ix &&
    "data" in ix &&
    typeof (ix as PartiallyDecodedInstruction).data === "string"
  );
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
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

type MintAccumulator = Map<string, Set<string>>;

function recordBuy(
  walletMints: MintAccumulator,
  accounts: PublicKey[],
  data: Uint8Array,
): void {
  if (discMatches(data, BUY_SOL_DISC)) {
    const buyer = accounts[BUYER_IX_INDEX]?.toBase58();
    if (buyer) addMint(walletMints, buyer, WRAPPED_SOL_MINT);
  } else if (discMatches(data, BUY_SPL_DISC)) {
    const buyer = accounts[BUYER_IX_INDEX]?.toBase58();
    const mint = accounts[SPL_MINT_IX_INDEX]?.toBase58();
    if (buyer && mint) addMint(walletMints, buyer, mint);
  }
}

function addMint(
  walletMints: MintAccumulator,
  wallet: string,
  mint: string,
): void {
  let set = walletMints.get(wallet);
  if (!set) {
    set = new Set();
    walletMints.set(wallet, set);
  }
  set.add(mint);
}

function ingestPartialInstruction(
  walletMints: MintAccumulator,
  ix: PartiallyDecodedInstruction,
  programId: PublicKey,
): void {
  if (!ix.programId.equals(programId)) return;
  recordBuy(walletMints, ix.accounts, utils.bytes.bs58.decode(ix.data));
}

function ingestParsedTransaction(
  walletMints: MintAccumulator,
  tx: ParsedTransactionWithMeta,
  programId: PublicKey,
): void {
  if (tx.meta?.err) return;

  for (const ix of tx.transaction.message.instructions) {
    if (isPartiallyDecoded(ix)) {
      ingestPartialInstruction(walletMints, ix, programId);
    }
  }

  for (const group of tx.meta?.innerInstructions ?? []) {
    for (const ix of group.instructions) {
      if (isPartiallyDecoded(ix)) {
        ingestPartialInstruction(walletMints, ix, programId);
      }
    }
  }
}

/** Decode legacy + v0 txs from `getTransaction` (covers cases parsed txs miss). */
function ingestRawTransaction(
  walletMints: MintAccumulator,
  tx: VersionedTransactionResponse,
  programId: PublicKey,
): void {
  try {
    const meta = tx.meta;
    if (!meta || meta.err) return;

    const message = tx.transaction.message;
    let getKey: (index: number) => PublicKey | undefined;

    if ("version" in message && message.version === 0) {
      const keys = message.getAccountKeys({
        accountKeysFromLookups: meta.loadedAddresses,
      });
      getKey = (index) => keys.get(index);
      for (const ix of message.compiledInstructions) {
        const pid = getKey(ix.programIdIndex);
        if (!pid?.equals(programId)) continue;
        const accounts = ix.accountKeyIndexes
          .map((i) => getKey(i))
          .filter((k): k is PublicKey => k !== undefined);
        recordBuy(walletMints, accounts, ix.data);
      }
    } else {
      const legacy = message as {
        accountKeys: PublicKey[];
        instructions: Array<{
          programIdIndex: number;
          accounts: number[];
          data: Buffer | Uint8Array;
        }>;
      };
      getKey = (index) => legacy.accountKeys[index];
      for (const ix of legacy.instructions) {
        const pid = getKey(ix.programIdIndex);
        if (!pid?.equals(programId)) continue;
        const accounts = ix.accounts
          .map((i) => getKey(i))
          .filter((k): k is PublicKey => k !== undefined);
        const data =
          ix.data instanceof Uint8Array ? ix.data : new Uint8Array(ix.data);
        recordBuy(walletMints, accounts, data);
      }
    }

    for (const group of meta.innerInstructions ?? []) {
      for (const ix of group.instructions) {
        const pid = getKey(ix.programIdIndex);
        if (!pid?.equals(programId)) continue;
        const accounts = ix.accounts
          .map((i) => getKey(i))
          .filter((k): k is PublicKey => k !== undefined);
        recordBuy(walletMints, accounts, utils.bytes.bs58.decode(ix.data));
      }
    }
  } catch {
    /* skip malformed tx */
  }
}

function walletMintsToRecord(walletMints: MintAccumulator): Record<string, string[]> {
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

/**
 * Inspect the draw account's transaction history and attribute each buyer to
 * the set of mints they paid with (SOL is reported as wrapped-SOL mint).
 */
export async function fetchDrawPaidWithMints(
  connection: Connection,
  programId: PublicKey,
  drawId: number,
): Promise<Record<string, string[]>> {
  const draw = drawPda(programId, drawId);

  const signatures: string[] = [];
  let before: string | undefined;
  const maxPages = 8;
  for (let page = 0; page < maxPages; page += 1) {
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

  const walletMints: MintAccumulator = new Map();

  await mapWithConcurrency(signatures, 2, async (sig) => {
    const raw = await connection
      .getTransaction(sig, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      })
      .catch(() => null);
    if (raw) {
      ingestRawTransaction(walletMints, raw, programId);
      return;
    }

    const parsed = await connection
      .getParsedTransaction(sig, { maxSupportedTransactionVersion: 0 })
      .catch(() => null);
    if (parsed) {
      ingestParsedTransaction(walletMints, parsed, programId);
    }
  });

  return walletMintsToRecord(walletMints);
}
