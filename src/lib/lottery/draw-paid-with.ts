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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimitError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return msg.includes("429") || msg.toLowerCase().includes("rate limit");
}

function decodeInstructionData(data: string | Uint8Array | Buffer): Uint8Array {
  if (typeof data === "string") return utils.bytes.bs58.decode(data);
  return data instanceof Uint8Array ? data : new Uint8Array(data);
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
        recordBuy(walletMints, accounts, decodeInstructionData(ix.data));
      }
    } else {
      const legacy = message as unknown as {
        accountKeys: PublicKey[];
        instructions: Array<{
          programIdIndex: number;
          accounts: number[];
          data: string;
        }>;
      };
      getKey = (index) => legacy.accountKeys[index];
      for (const ix of legacy.instructions) {
        const pid = getKey(ix.programIdIndex);
        if (!pid?.equals(programId)) continue;
        const accounts = ix.accounts
          .map((i) => getKey(i))
          .filter((k): k is PublicKey => k !== undefined);
        recordBuy(walletMints, accounts, decodeInstructionData(ix.data));
      }
    }

    for (const group of meta.innerInstructions ?? []) {
      for (const ix of group.instructions) {
        const pid = getKey(ix.programIdIndex);
        if (!pid?.equals(programId)) continue;
        const accounts = ix.accounts
          .map((i) => getKey(i))
          .filter((k): k is PublicKey => k !== undefined);
        recordBuy(walletMints, accounts, decodeInstructionData(ix.data));
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

export type DrawPaidWithResult = {
  paidWith: Record<string, string[]>;
  /** False when any draw tx could not be fetched (e.g. RPC rate limit). */
  complete: boolean;
};

async function fetchTransactionForSignature(
  connection: Connection,
  signature: string,
): Promise<
  | { kind: "raw"; tx: VersionedTransactionResponse }
  | { kind: "parsed"; tx: ParsedTransactionWithMeta }
  | null
> {
  const rawOpts = {
    commitment: "confirmed" as const,
    maxSupportedTransactionVersion: 0 as const,
  };

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const raw = await connection.getTransaction(signature, rawOpts);
      if (raw) return { kind: "raw", tx: raw };
    } catch (e) {
      if (isRateLimitError(e) && attempt < 4) {
        await sleep(400 * (attempt + 1));
        continue;
      }
      break;
    }
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const parsed = await connection.getParsedTransaction(signature, rawOpts);
      if (parsed) return { kind: "parsed", tx: parsed };
    } catch (e) {
      if (isRateLimitError(e) && attempt < 4) {
        await sleep(400 * (attempt + 1));
        continue;
      }
      break;
    }
  }

  return null;
}

/**
 * Inspect the draw account's transaction history and attribute each buyer to
 * the set of mints they paid with (SOL is reported as wrapped-SOL mint).
 */
export async function fetchDrawPaidWithMints(
  connection: Connection,
  programId: PublicKey,
  drawId: number,
): Promise<DrawPaidWithResult> {
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
  let failedFetches = 0;

  await mapWithConcurrency(signatures, 1, async (sig) => {
    const fetched = await fetchTransactionForSignature(connection, sig);
    if (!fetched) {
      failedFetches += 1;
      return;
    }
    if (fetched.kind === "raw") {
      ingestRawTransaction(walletMints, fetched.tx, programId);
    } else {
      ingestParsedTransaction(walletMints, fetched.tx, programId);
    }
  });

  return {
    paidWith: walletMintsToRecord(walletMints),
    complete: failedFetches === 0,
  };
}
