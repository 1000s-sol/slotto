/**
 * Close leftover Switchboard randomness accounts created by the keeper
 * during failed cranks, returning rent to the keeper.
 *
 *   LOTTERY_RPC_URL=https://api.mainnet-beta.solana.com \
 *     ./node_modules/.bin/tsx scripts/_reclaim-switchboard-rent.ts --dry-run
 *
 *   LOTTERY_RPC_URL=https://api.mainnet-beta.solana.com \
 *     ./node_modules/.bin/tsx scripts/_reclaim-switchboard-rent.ts
 */
import "dotenv/config";

import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  type TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import * as sb from "@switchboard-xyz/on-demand";

import { loadLotteryKeeperKeypair } from "../src/lib/lottery/keeper-wallet";
import { resolveLotteryRpcUrl } from "../src/lib/lottery/rpc-url";

const RPC = process.env.LOTTERY_RPC_URL?.trim() || resolveLotteryRpcUrl();
const SWITCHBOARD = new PublicKey(
  "SBondMDrcV3K4kxZR1HNVT7osZxAHVHgYXL5Ze1oMUv",
);
const SIG_LIMIT = Number(process.env.RECLAIM_SIG_LIMIT ?? "80");
const dryRun = process.argv.includes("--dry-run");

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function withRetry<T>(
  label: string,
  fn: () => Promise<T>,
  tries = 6,
): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i += 1) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      const msg = e instanceof Error ? e.message : String(e);
      if (!/429|too many requests|rate limit/i.test(msg) || i === tries - 1) {
        throw e;
      }
      const wait = 800 * 2 ** i;
      console.log(`  retry ${label} in ${wait}ms`);
      await sleep(wait);
    }
  }
  throw last;
}

function redactRpc(url: string): string {
  try {
    const u = new URL(url);
    if (u.searchParams.has("api-key")) u.searchParams.set("api-key", "***");
    return u.toString();
  } catch {
    return url.replace(/api-key=[^&]+/i, "api-key=***");
  }
}

function walletFrom(payer: Keypair) {
  return {
    payer,
    publicKey: payer.publicKey,
    signTransaction: async (tx: any) => {
      if ("version" in tx) tx.sign([payer]);
      else tx.partialSign(payer);
      return tx;
    },
    signAllTransactions: async (txs: any[]) => {
      for (const tx of txs) {
        if ("version" in tx) tx.sign([payer]);
        else tx.partialSign(payer);
      }
      return txs;
    },
  };
}

async function sendIx(
  connection: Connection,
  payer: Keypair,
  ix: TransactionInstruction,
): Promise<string> {
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");
  const tx = new VersionedTransaction(
    new TransactionMessage({
      payerKey: payer.publicKey,
      recentBlockhash: blockhash,
      instructions: [ix],
    }).compileToV0Message(),
  );
  tx.sign([payer]);
  const sig = await connection.sendTransaction(tx, {
    skipPreflight: false,
    maxRetries: 3,
  });
  await connection.confirmTransaction(
    { signature: sig, blockhash, lastValidBlockHeight },
    "confirmed",
  );
  return sig;
}

async function main() {
  const payer = loadLotteryKeeperKeypair();
  if (!payer) throw new Error("no keeper keypair");
  const connection = new Connection(RPC, {
    commitment: "confirmed",
    disableRetryOnRateLimit: true,
  });

  const before = await withRetry("balance", () =>
    connection.getBalance(payer.publicKey),
  );
  console.log("mode", dryRun ? "DRY-RUN" : "CLOSE");
  console.log("keeper", payer.publicKey.toBase58());
  console.log("rpc", redactRpc(RPC));
  console.log("keeper SOL", (before / LAMPORTS_PER_SOL).toFixed(6));

  const sigs = await connection.getSignaturesForAddress(payer.publicKey, {
    limit: SIG_LIMIT,
  });
  console.log("scanning", sigs.length, "recent keeper txs…");

  const randomness = new Set<string>();
  for (const s of sigs) {
    if (s.err) continue;
    await sleep(150);
    const tx = await withRetry(`tx ${s.signature.slice(0, 8)}`, () =>
      connection.getParsedTransaction(s.signature, {
        maxSupportedTransactionVersion: 0,
      }),
    );
    if (!tx) continue;
    const logs = tx.meta?.logMessages?.join("\n") ?? "";
    if (!logs.includes("RandomnessInit")) continue;
    const keys = tx.transaction.message.accountKeys;
    const pre = tx.meta?.preBalances ?? [];
    const post = tx.meta?.postBalances ?? [];
    for (let i = 0; i < keys.length; i += 1) {
      const pk = keys[i]?.pubkey.toBase58();
      if (!pk || pk === payer.publicKey.toBase58()) continue;
      const delta = (post[i] ?? 0) - (pre[i] ?? 0);
      // Randomness account rent is ~0.004232 SOL
      if (delta > 3_500_000 && delta < 5_000_000) {
        randomness.add(pk);
      }
    }
  }

  console.log("candidate randomness accounts", randomness.size);

  const sbProgram = await sb.AnchorUtils.loadProgramFromConnection(
    connection,
    walletFrom(payer),
  );

  let recoverable = 0;
  let closed = 0;
  let skipped = 0;
  for (const pkStr of randomness) {
    const pk = new PublicKey(pkStr);
    await sleep(120);
    const info = await withRetry(`info ${pkStr.slice(0, 8)}`, () =>
      connection.getAccountInfo(pk, "confirmed"),
    );
    if (!info) {
      console.log("gone", pkStr);
      skipped += 1;
      continue;
    }
    if (!info.owner.equals(SWITCHBOARD)) {
      console.log("not switchboard", pkStr, info.owner.toBase58());
      skipped += 1;
      continue;
    }
    const rng = new sb.Randomness(sbProgram, pk);
    let authority = "unknown";
    try {
      const data = await withRetry(`load ${pkStr.slice(0, 8)}`, () =>
        rng.loadData(),
      );
      authority = data.authority?.toBase58?.() ?? String(data.authority);
    } catch (e) {
      console.log(
        "load fail",
        pkStr,
        e instanceof Error ? e.message.slice(0, 120) : e,
      );
      skipped += 1;
      continue;
    }
    if (authority !== payer.publicKey.toBase58()) {
      console.log("other authority", pkStr, authority);
      skipped += 1;
      continue;
    }
    recoverable += info.lamports;
    console.log(
      "owned",
      pkStr,
      (info.lamports / LAMPORTS_PER_SOL).toFixed(6),
      "SOL",
    );
    if (dryRun) continue;
    try {
      const ix = await withRetry(`closeIx ${pkStr.slice(0, 8)}`, () =>
        rng.closeIx(),
      );
      const sig = await withRetry(`send ${pkStr.slice(0, 8)}`, () =>
        sendIx(connection, payer, ix),
      );
      console.log("  closed", sig);
      closed += 1;
      await sleep(400);
    } catch (e) {
      console.log(
        "  close failed",
        e instanceof Error ? e.message.slice(0, 400) : e,
      );
    }
  }

  const after = await withRetry("balance after", () =>
    connection.getBalance(payer.publicKey),
  );
  console.log("recoverable (still open)", (recoverable / LAMPORTS_PER_SOL).toFixed(6), "SOL");
  console.log("closed this run", closed);
  console.log("skipped", skipped);
  console.log(
    "keeper SOL now",
    (after / LAMPORTS_PER_SOL).toFixed(6),
    "delta",
    ((after - before) / LAMPORTS_PER_SOL).toFixed(6),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
