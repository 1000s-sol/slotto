/**
 * Force settle draw #14 when Crossbar says "no eligible oracles".
 * Picks an on-chain queue oracle and passes it to commitIx (skips health filter).
 *
 *   LOTTERY_RPC_URL=https://api.mainnet-beta.solana.com \
 *   LOTTERY_RANDOMNESS_ACCOUNT=GEF7LkWMrJf7e859GZ48ArHFcSFjEbQooPwawbWNTR3 \
 *     ./node_modules/.bin/tsx scripts/_settle-force.ts
 */
import "dotenv/config";

import * as anchor from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import * as sb from "@switchboard-xyz/on-demand";

import { fetchDrawById } from "../src/lib/lottery/chain";
import { lotteryProgramId } from "../src/lib/lottery/config";
import { DrawState } from "../src/lib/lottery/constants";
import { loadLotteryKeeperKeypair } from "../src/lib/lottery/keeper-wallet";
import { createLotteryProgram } from "../src/lib/lottery/program";
import { switchboardQueueForCluster } from "../src/lib/lottery/switchboard-config";
import {
  revealSwitchboardVrf,
  settleDrawWithSwitchboard,
} from "../src/lib/lottery/switchboard-crank";

const DRAW = 14;
const RNG = new PublicKey(
  process.env.LOTTERY_RANDOMNESS_ACCOUNT ||
    "GEF7LkWMrJf7e859GZ48ArHFcSFjEbQooPwawbWNTR3",
);
const RPC =
  process.env.LOTTERY_RPC_URL || "https://api.mainnet-beta.solana.com";

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) =>
      setTimeout(() => rej(new Error(`TIMEOUT ${label} ${ms}ms`)), ms),
    ),
  ]);
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

async function main() {
  const t0 = Date.now();
  const log = (...a: unknown[]) =>
    console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);

  const payer = loadLotteryKeeperKeypair();
  if (!payer) throw new Error("no keeper");
  log("keeper", payer.publicKey.toBase58());
  log("randomness", RNG.toBase58());
  log("rpc", RPC);

  const connection = new Connection(RPC, {
    commitment: "confirmed",
    disableRetryOnRateLimit: true,
  });
  const bal = await withTimeout(
    connection.getBalance(payer.publicKey),
    20_000,
    "balance",
  );
  log("balance", bal);

  const programId = lotteryProgramId();
  let draw = await withTimeout(
    fetchDrawById(connection, programId, DRAW),
    20_000,
    "fetchDraw",
  );
  if (!draw) throw new Error("draw missing");
  log("draw state", draw.state, "tickets", draw.totalTickets);

  const lotteryProgram = createLotteryProgram(
    connection,
    new anchor.Wallet(payer),
  );

  log("load switchboard program…");
  const sbProgram = await withTimeout(
    sb.AnchorUtils.loadProgramFromConnection(
      connection,
      walletFrom(payer),
    ),
    60_000,
    "sbProgram",
  );
  const queuePk = switchboardQueueForCluster();
  const queue = new sb.Queue(sbProgram, queuePk);
  log("queue", queuePk.toBase58());

  const oracleKeys: PublicKey[] = await withTimeout(
    queue.fetchOracleKeys(),
    45_000,
    "fetchOracleKeys",
  );
  log(
    "on-chain oracles",
    oracleKeys.length,
    oracleKeys.slice(0, 8).map((k) => k.toBase58()),
  );
  if (oracleKeys.length === 0) {
    throw new Error("Queue has zero oracles on-chain — cannot force commit");
  }

  if (draw.state === DrawState.SalesClosed) {
    const randomness = new sb.Randomness(sbProgram, RNG);
    const authority = (await randomness.loadData()).authority;
    log("randomness authority", authority.toBase58());

    let committed = false;
    let lastErr: unknown;
    for (let i = 0; i < oracleKeys.length; i += 1) {
      const oracle = oracleKeys[i]!;
      log(`try commit with oracle ${i + 1}/${oracleKeys.length}`, oracle.toBase58());
      try {
        const commitIx = await withTimeout(
          randomness.commitIx(queuePk, authority, oracle),
          30_000,
          "commitIx",
        );
        const requestIx = await lotteryProgram.methods
          .requestVrf()
          .accounts({ draw: draw.draw })
          .remainingAccounts([
            { pubkey: RNG, isWritable: false, isSigner: false },
          ])
          .instruction();

        const { blockhash, lastValidBlockHeight } =
          await connection.getLatestBlockhash("confirmed");
        const tx = new VersionedTransaction(
          new TransactionMessage({
            payerKey: payer.publicKey,
            recentBlockhash: blockhash,
            instructions: [commitIx, requestIx],
          }).compileToV0Message(),
        );
        tx.sign([payer]);

        const sig = await withTimeout(
          connection.sendTransaction(tx, {
            skipPreflight: false,
            maxRetries: 3,
          }),
          60_000,
          "send",
        );
        log("sent", sig);
        await withTimeout(
          connection.confirmTransaction(
            { signature: sig, blockhash, lastValidBlockHeight },
            "confirmed",
          ),
          90_000,
          "confirm",
        );
        log("commit+request CONFIRMED with oracle", oracle.toBase58());
        committed = true;
        break;
      } catch (e) {
        lastErr = e;
        log(
          "oracle failed",
          e instanceof Error ? e.message.slice(0, 300) : e,
        );
      }
    }
    if (!committed) {
      throw lastErr instanceof Error
        ? lastErr
        : new Error("all oracle force-commits failed");
    }
  }

  draw = await fetchDrawById(connection, programId, DRAW);
  log("after commit state", draw?.state, "vrf", draw?.vrfRequest.toBase58());

  if (draw?.state === DrawState.VrfRequested) {
    for (let attempt = 1; attempt <= 8; attempt += 1) {
      log(`reveal+settle attempt ${attempt}/8`);
      try {
        try {
          const rsig = await withTimeout(
            revealSwitchboardVrf(connection, payer, RNG),
            60_000,
            "reveal",
          );
          log("reveal", rsig);
        } catch (e) {
          log(
            "reveal skip/fail",
            e instanceof Error ? e.message.slice(0, 250) : e,
          );
        }
        const { signature, winningTicketId } = await withTimeout(
          settleDrawWithSwitchboard(
            connection,
            lotteryProgram,
            programId,
            DRAW,
            RNG,
          ),
          90_000,
          "settle",
        );
        log("SETTLED", signature, "ticket", winningTicketId);
        break;
      } catch (e) {
        log("settle fail", e instanceof Error ? e.message.slice(0, 300) : e);
        await new Promise((r) => setTimeout(r, 8_000));
      }
    }
  }

  draw = await fetchDrawById(connection, programId, DRAW);
  log(
    "FINAL",
    `state=${draw?.state} winner=${draw?.winner?.toBase58?.() ?? draw?.winner}`,
  );
  if (draw?.state !== DrawState.Settled) process.exitCode = 1;
}

main().catch((e) => {
  console.error("FAIL", e instanceof Error ? e.message : e);
  process.exit(1);
});
