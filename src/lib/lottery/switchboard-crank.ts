import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  type Transaction,
  type TransactionInstruction,
  TransactionMessage,
  type VersionedTransaction as Web3VersionedTransaction,
  VersionedTransaction,
} from "@solana/web3.js";

import { fetchDrawById } from "./chain";
import { DrawState } from "./constants";
import { ticketChunkPda } from "./pdas";
import type { SlottoLotteryProgram } from "./program";
import { globalConfigPda } from "./pdas";
import { switchboardQueueForCluster } from "./switchboard-config";
import {
  ticketChunkIndex,
  ticketSlotInChunk,
} from "./stub-settle";
import { winningTicketFromVrfBytes } from "./winning-ticket-from-vrf";

type RandomnessSdk = typeof import("@switchboard-xyz/on-demand");
const RANDOMNESS_ACCOUNT_MIN_LEN = 184;
const REVEAL_SLOT_OFFSET = 144;
const VALUE_OFFSET = 152;
const VALUE_LEN = 32;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function isBlockhashExpiredError(e: unknown): boolean {
  const msg = (e instanceof Error ? e.message : String(e)).toLowerCase();
  return (
    msg.includes("block height exceeded") ||
    msg.includes("blockhash not found") ||
    msg.includes("has expired") ||
    msg.includes("transaction expired")
  );
}

async function waitForSignatureConfirmed(
  connection: Connection,
  signature: string,
  timeoutMs: number,
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { value } = await connection.getSignatureStatus(signature, {
      searchTransactionHistory: true,
    });
    if (value?.err) {
      throw new Error(
        `Transaction failed: ${JSON.stringify(value.err)} (${signature})`,
      );
    }
    if (
      value?.confirmationStatus === "confirmed" ||
      value?.confirmationStatus === "finalized"
    ) {
      return true;
    }
    await sleep(750);
  }
  const { value } = await connection.getSignatureStatus(signature, {
    searchTransactionHistory: true,
  });
  if (value?.err) {
    throw new Error(
      `Transaction failed: ${JSON.stringify(value.err)} (${signature})`,
    );
  }
  return (
    value?.confirmationStatus === "confirmed" ||
    value?.confirmationStatus === "finalized"
  );
}

/**
 * Send a keeper tx and poll signature status. Retries with a fresh blockhash
 * instead of throwing "block height exceeded" when RPC is slow (draw #20).
 */
async function sendAndConfirmKeeperTx(
  connection: Connection,
  signers: Keypair[],
  buildInstructions: () =>
    | Promise<TransactionInstruction[]>
    | TransactionInstruction[],
  label: string,
): Promise<string> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const ixs = await buildInstructions();
      const { blockhash } = await connection.getLatestBlockhash("confirmed");
      const tx = new VersionedTransaction(
        new TransactionMessage({
          payerKey: signers[0]!.publicKey,
          recentBlockhash: blockhash,
          instructions: ixs,
        }).compileToV0Message(),
      );
      tx.sign(signers);

      const sig = await connection.sendTransaction(tx, {
        skipPreflight: false,
        maxRetries: 2,
      });

      const landed = await waitForSignatureConfirmed(connection, sig, 40_000);
      if (landed) return sig;

      console.warn(
        `[switchboard] ${label} attempt ${attempt + 1}: not confirmed, retrying`,
        sig.slice(0, 16),
      );
      lastErr = new Error(
        `Signature ${sig} not confirmed in time — retrying`,
      );
    } catch (e) {
      lastErr = e;
      if (isBlockhashExpiredError(e)) {
        console.warn(
          `[switchboard] ${label} attempt ${attempt + 1}: blockhash expired, retrying`,
        );
        await sleep(400);
        continue;
      }
      throw e;
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error(`${label} failed to confirm — click Settle again`);
}

function switchboardWalletFromKeypair(payer: Keypair) {
  return {
    payer,
    publicKey: payer.publicKey,
    signTransaction: async <T extends Transaction | Web3VersionedTransaction>(tx: T) => {
      if ("version" in tx) {
        tx.sign([payer]);
      } else {
        tx.partialSign(payer);
      }
      return tx;
    },
    signAllTransactions: async <
      T extends Transaction | Web3VersionedTransaction,
    >(txs: T[]) => {
      for (const tx of txs) {
        if ("version" in tx) {
          tx.sign([payer]);
        } else {
          tx.partialSign(payer);
        }
      }
      return txs;
    },
  };
}

/** Create a Switchboard randomness account for one draw (fund payer with ~0.01 SOL). */
export async function createDrawRandomnessAccount(
  connection: Connection,
  payer: Keypair,
): Promise<PublicKey> {
  const sb = await loadSwitchboardSdk();
  const queue = switchboardQueueForCluster();
  const { AnchorUtils, Randomness } = sb;
  const sbProgram = await AnchorUtils.loadProgramFromConnection(
    connection,
    switchboardWalletFromKeypair(payer),
  );
  const randomnessKp = Keypair.generate();
  const [rng, createIx] = await Randomness.create(
    sbProgram,
    randomnessKp,
    queue,
    payer.publicKey,
  );

  await sendAndConfirmKeeperTx(
    connection,
    [payer, randomnessKp],
    () => [createIx as TransactionInstruction],
    "RandomnessInit",
  );

  return rng.pubkey;
}

async function loadSwitchboardSdk(): Promise<RandomnessSdk> {
  try {
    return await import("@switchboard-xyz/on-demand");
  } catch {
    throw new Error(
      "Install @switchboard-xyz/on-demand (npm install) for Switchboard VRF crank.",
    );
  }
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) =>
      setTimeout(() => rej(new Error(`TIMEOUT ${label} after ${ms}ms`)), ms),
    ),
  ]);
}

function isOracleSelectionError(e: unknown): boolean {
  const msg = (e instanceof Error ? e.message : String(e)).toLowerCase();
  return (
    msg.includes("no eligible randomness oracle") ||
    msg.includes("no randomness oracle candidates") ||
    msg.includes("timeout commitix")
  );
}

/** Switchboard RandomnessCommit rejected the oracle quote (stale / wrong oracle). */
export function isInvalidQuoteError(e: unknown): boolean {
  const msg = (e instanceof Error ? e.message : String(e)).toLowerCase();
  return (
    msg.includes("invalidquote") ||
    msg.includes("invalid quote") ||
    msg.includes("0x1771") ||
    msg.includes("error number: 6001") ||
    msg.includes("error code: invalidquote")
  );
}

/**
 * Crossbar "eligible oracle" filtering is what blocked draw #14. If it fails
 * or hangs, commit with an on-chain queue oracle (the path that actually settled).
 *
 * Important: `commitIx` can resolve successfully with a quote that still fails
 * on-chain as InvalidQuote (draw #20). Callers must simulate / rotate oracles.
 */
async function listCommitIxBuilders(
  sb: RandomnessSdk,
  sbProgram: Awaited<
    ReturnType<RandomnessSdk["AnchorUtils"]["loadProgramFromConnection"]>
  >,
  randomness: InstanceType<RandomnessSdk["Randomness"]>,
  queue: PublicKey,
): Promise<Array<{ label: string; build: () => Promise<unknown> }>> {
  const builders: Array<{ label: string; build: () => Promise<unknown> }> = [
    {
      label: "crossbar-default",
      build: () => randomness.commitIx(queue),
    },
  ];

  try {
    const queueAccount = new sb.Queue(sbProgram, queue);
    const oracleKeys: PublicKey[] = await queueAccount.fetchOracleKeys();
    if (oracleKeys.length === 0) return builders;
    const orderedKeys = await preferOraclesWithHealthyGateways(
      sb,
      sbProgram,
      oracleKeys,
    );
    const data = await randomness.loadData();
    const authority = data.authority as PublicKey;
    for (let i = 0; i < orderedKeys.length; i += 1) {
      const oracle = orderedKeys[i]!;
      builders.push({
        label: `oracle-${i}-${oracle.toBase58().slice(0, 8)}`,
        build: () => randomness.commitIx(queue, authority, oracle),
      });
    }
  } catch (e) {
    console.warn(
      "[switchboard] could not enumerate on-chain oracles for commit:",
      e instanceof Error ? e.message : e,
    );
  }
  return builders;
}

async function preferOraclesWithHealthyGateways(
  sb: RandomnessSdk,
  sbProgram: Awaited<
    ReturnType<RandomnessSdk["AnchorUtils"]["loadProgramFromConnection"]>
  >,
  oracleKeys: PublicKey[],
): Promise<PublicKey[]> {
  const { Oracle } = sb as RandomnessSdk & {
    Oracle: new (
      program: unknown,
      pubkey: PublicKey,
    ) => {
      loadData: () => Promise<{ gatewayUri: number[] }>;
    };
  };
  // Cap + parallel probes — sequential 4s timeouts were hanging admin Settle.
  const limited = oracleKeys.slice(0, 8);
  const ranked = await Promise.all(
    limited.map(async (key) => {
      try {
        const od = await new Oracle(sbProgram, key).loadData();
        const url = String.fromCharCode(...od.gatewayUri).replace(/\0+$/, "");
        if (!url) return { key, score: 1 };
        const ok = await gatewayResponds(url);
        return { key, score: ok ? 0 : 1 };
      } catch {
        return { key, score: 2 };
      }
    }),
  );
  ranked.sort((a, b) => a.score - b.score);
  return ranked.map((r) => r.key);
}

async function gatewayResponds(gatewayUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${gatewayUrl.replace(/\/$/, "")}/gateway/api/v1`, {
      method: "GET",
      signal: AbortSignal.timeout(1_500),
    });
    // Any non-network response means the host is up (401/404/405 still fine).
    return res.status !== 502 && res.status !== 503 && res.status !== 504;
  } catch {
    return false;
  }
}

/**
 * Authority recovery: VrfRequested → SalesClosed and clear vrf_request.
 * DISABLED — automatic use wiped live settles (draw #20). Keep the on-chain
 * instruction for manual ops scripts only; do not call from the crank.
 */
export async function resetDrawVrf(
  _program: SlottoLotteryProgram,
  _programId: PublicKey,
  _authority: Keypair,
  _drawPubkey: PublicKey,
): Promise<string> {
  throw new Error(
    "reset_vrf is disabled in the app crank (it was wiping VrfRequested). Settle by reveal+retry only.",
  );
}

/** True when the oracle assigned to this randomness account's gateway is down. */
export async function isAssignedOracleGatewayDown(
  connection: Connection,
  payer: Keypair,
  randomnessAccount: PublicKey,
): Promise<{ down: boolean; gatewayUrl: string }> {
  const sb = await loadSwitchboardSdk();
  const { AnchorUtils, Randomness, Oracle } = sb as RandomnessSdk & {
    Oracle: new (
      program: unknown,
      pubkey: PublicKey,
    ) => {
      loadData: () => Promise<{ gatewayUri: number[] }>;
    };
  };
  const sbProgram = await AnchorUtils.loadProgramFromConnection(
    connection,
    switchboardWalletFromKeypair(payer),
  );
  const data = await new Randomness(sbProgram, randomnessAccount).loadData();
  const od = await new Oracle(sbProgram, data.oracle).loadData();
  const gatewayUrl = String.fromCharCode(...od.gatewayUri).replace(/\0+$/, "");
  if (!gatewayUrl) return { down: true, gatewayUrl: "" };
  const down = !(await gatewayResponds(gatewayUrl));
  return { down, gatewayUrl };
}

/**
 * Commit Switchboard randomness + `request_vrf` in one transaction.
 * Randomness account must be created beforehand (see docs/switchboard-vrf.md).
 *
 * Rotates Crossbar + on-chain oracles and **simulates** each commit before
 * broadcast — `commitIx` can succeed while RandomnessCommit still fails with
 * InvalidQuote (6001 / 0x1771) on-chain.
 */
export async function requestSwitchboardVrf(
  connection: Connection,
  program: SlottoLotteryProgram,
  payer: Keypair,
  drawPubkey: PublicKey,
  randomnessAccount: PublicKey,
): Promise<string> {
  const sb = await loadSwitchboardSdk();
  const queue = switchboardQueueForCluster();
  const { AnchorUtils, Randomness } = sb;
  const sbProgram = await AnchorUtils.loadProgramFromConnection(
    connection,
    switchboardWalletFromKeypair(payer),
  );

  const randomness = new Randomness(sbProgram, randomnessAccount);
  const builders = (
    await listCommitIxBuilders(sb, sbProgram, randomness, queue)
  ).slice(0, 6);
  if (builders.length === 0) {
    throw new Error("Switchboard commitIx missing (SDK / queue mismatch)");
  }

  const requestIx = await program.methods
    .requestVrf()
    .accounts({ draw: drawPubkey })
    .remainingAccounts([
      {
        pubkey: randomnessAccount,
        isWritable: false,
        isSigner: false,
      },
    ])
    .instruction();

  let lastErr: unknown;
  for (const { label, build } of builders) {
    try {
      const commitIx = (await withTimeout(
        build(),
        20_000,
        `commitIx-${label}`,
      )) as TransactionInstruction;
      if (!commitIx) {
        continue;
      }

      // Simulate with a throwaway blockhash first (InvalidQuote filter).
      {
        const { blockhash: simHash } =
          await connection.getLatestBlockhash("confirmed");
        const simTx = new VersionedTransaction(
          new TransactionMessage({
            payerKey: payer.publicKey,
            recentBlockhash: simHash,
            instructions: [commitIx, requestIx],
          }).compileToV0Message(),
        );
        simTx.sign([payer]);
        const sim = await connection.simulateTransaction(simTx, {
          sigVerify: true,
          commitment: "confirmed",
        });
        if (sim.value.err) {
          const logs = (sim.value.logs ?? []).join("\n");
          const err = new Error(
            `Simulation failed. ${JSON.stringify(sim.value.err)}\n${logs}`,
          );
          lastErr = err;
          if (isInvalidQuoteError(err)) {
            console.warn(
              `[switchboard] commit+request ${label} InvalidQuote — trying next oracle`,
            );
            continue;
          }
          throw err;
        }
      }

      // Fresh commit quote + blockhash on each send attempt (quotes go stale).
      const sig = await sendAndConfirmKeeperTx(
        connection,
        [payer],
        async () => {
          const freshCommit = (await withTimeout(
            build(),
            20_000,
            `commitIx-${label}-send`,
          )) as TransactionInstruction;
          return [freshCommit, requestIx];
        },
        `commit+request-${label}`,
      );
      return sig;
    } catch (e) {
      lastErr = e;
      if (
        isInvalidQuoteError(e) ||
        isOracleSelectionError(e) ||
        isBlockhashExpiredError(e)
      ) {
        console.warn(
          `[switchboard] commit+request ${label} failed:`,
          e instanceof Error ? e.message.slice(0, 180) : e,
        );
        continue;
      }
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("0x1771") || /invalidquote/i.test(msg)) {
        continue;
      }
      throw e;
    }
  }

  throw lastErr instanceof Error
    ? lastErr
    : new Error(
        "All Switchboard commit oracles failed (InvalidQuote). Recreate randomness and retry.",
      );
}

type SwitchboardRevealResponse = {
  signature: string;
  recovery_id: number;
  value: string | number[];
};

type SwitchboardGateway = {
  fetchRandomnessReveal: (
    params: Record<string, unknown>,
  ) => Promise<SwitchboardRevealResponse>;
};

/**
 * Reveal Switchboard randomness (after commit/request, before settle).
 *
 * Fetch reveal from the **assigned** oracle gateway only (other gateways
 * return payloads that fail on-chain with InvalidSecpSignature), then build
 * `randomnessReveal` with the same accounts as the SDK.
 */
export async function revealSwitchboardVrf(
  connection: Connection,
  payer: Keypair,
  randomnessAccount: PublicKey,
): Promise<string> {
  const sb = await loadSwitchboardSdk();
  const {
    AnchorUtils,
    Randomness,
    Gateway,
    Oracle,
    State,
    SOL_NATIVE_MINT,
    SPL_TOKEN_PROGRAM_ID,
    SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID,
    SPL_SYSVAR_SLOT_HASHES_ID,
    getAssociatedTokenAddressSync,
  } = sb as RandomnessSdk & {
    Gateway: new (url: string) => SwitchboardGateway;
    Oracle: new (
      program: unknown,
      pubkey: PublicKey,
    ) => {
      loadData: () => Promise<{ gatewayUri: number[] }>;
    };
    State: { keyFromSeed: (program: unknown) => PublicKey };
    SOL_NATIVE_MINT: PublicKey;
    SPL_TOKEN_PROGRAM_ID: PublicKey;
    SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID: PublicKey;
    SPL_SYSVAR_SLOT_HASHES_ID: PublicKey;
    getAssociatedTokenAddressSync: (
      mint: PublicKey,
      owner: PublicKey,
    ) => PublicKey;
  };
  const bs58 = (await import("bs58")).default;
  const sbProgram = await AnchorUtils.loadProgramFromConnection(
    connection,
    switchboardWalletFromKeypair(payer),
  );
  const randomness = new Randomness(sbProgram, randomnessAccount);
  const data = await randomness.loadData();
  if (!data?.seedSlot || Number(data.seedSlot) === 0) {
    throw new Error("Switchboard randomness not committed yet");
  }

  const oracle = new Oracle(sbProgram, data.oracle);
  const oracleData = await oracle.loadData();
  const assignedGateway = String.fromCharCode(...oracleData.gatewayUri).replace(
    /\0+$/,
    "",
  );
  if (!assignedGateway) {
    throw new Error("Switchboard oracle gateway URI missing");
  }

  // Only the assigned oracle can produce a valid secp signature. Other Crossbar
  // gateways may return a reveal payload, but settle fails with InvalidSecpSignature.
  const revealParams = {
    randomnessAccount,
    slothash: bs58.encode(Buffer.from(data.seedSlothash)),
    slot: Number(data.seedSlot),
    rpc: connection.rpcEndpoint,
  };
  let reveal: SwitchboardRevealResponse;
  try {
    reveal = await new Gateway(assignedGateway).fetchRandomnessReveal(
      revealParams,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(
      `Assigned Switchboard oracle gateway reveal failed (${assignedGateway}): ${msg}`,
    );
  }

  const stats = PublicKey.findProgramAddressSync(
    [Buffer.from("OracleRandomnessStats"), data.oracle.toBuffer()],
    sbProgram.programId,
  )[0];

  const revealIx = sbProgram.instruction.randomnessReveal(
    {
      signature: Buffer.from(reveal.signature, "base64"),
      recoveryId: reveal.recovery_id,
      value: reveal.value,
    },
    {
      accounts: {
        randomness: randomnessAccount,
        oracle: data.oracle,
        queue: data.queue,
        stats,
        authority: data.authority,
        payer: payer.publicKey,
        recentSlothashes: SPL_SYSVAR_SLOT_HASHES_ID,
        systemProgram: SystemProgram.programId,
        rewardEscrow: getAssociatedTokenAddressSync(
          SOL_NATIVE_MINT,
          randomnessAccount,
        ),
        tokenProgram: SPL_TOKEN_PROGRAM_ID,
        associatedTokenProgram: SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID,
        wrappedSolMint: SOL_NATIVE_MINT,
        programState: State.keyFromSeed(sbProgram),
      },
    },
  );

  return sendAndConfirmKeeperTx(
    connection,
    [payer],
    () => [revealIx as TransactionInstruction],
    "randomnessReveal",
  );
}

/** Preview winning ticket from revealed randomness (keeper helper). */
export async function previewSwitchboardWinningTicket(
  connection: Connection,
  randomnessAccount: PublicKey,
  totalTickets: number,
): Promise<number> {
  const account = await connection.getAccountInfo(randomnessAccount);
  if (!account?.data) {
    throw new Error("Randomness account not found");
  }
  const slot = await connection.getSlot("confirmed");
  const data = account.data;
  if (data.length < RANDOMNESS_ACCOUNT_MIN_LEN) {
    throw new Error("Randomness account too small");
  }

  const revealSlot = Number(data.readBigUInt64LE(REVEAL_SLOT_OFFSET));
  if (!Number.isFinite(revealSlot) || revealSlot <= 0 || slot < revealSlot) {
    throw new Error("Randomness not resolved yet");
  }

  const value = data.subarray(VALUE_OFFSET, VALUE_OFFSET + VALUE_LEN);
  if (value.length !== VALUE_LEN || value.every((b) => b === 0)) {
    throw new Error("Randomness value missing");
  }

  return winningTicketFromVrfBytes(value, totalTickets);
}

export async function settleDrawWithSwitchboard(
  connection: Connection,
  program: SlottoLotteryProgram,
  programId: PublicKey,
  drawId: number,
  randomnessAccount: PublicKey,
): Promise<{ signature: string; winningTicketId: number }> {
  const draw = await fetchDrawById(connection, programId, drawId);
  if (!draw) throw new Error(`Draw #${drawId} not found`);
  if (draw.state !== DrawState.VrfRequested) {
    throw new Error(`Draw #${drawId} is not VrfRequested`);
  }

  const winningId = await previewSwitchboardWinningTicket(
    connection,
    randomnessAccount,
    draw.totalTickets,
  );
  const chunkIdx = ticketChunkIndex(winningId);
  const slotInChunk = ticketSlotInChunk(winningId);
  const chunkPk = ticketChunkPda(programId, draw.draw, chunkIdx);
  const chunk = await program.account.ticketChunk.fetch(chunkPk);
  const winnerPk = chunk.owners[slotInChunk];

  const sig = await program.methods
    .settle()
    .accounts({
      draw: draw.draw,
      prizeVault: draw.prizeVault,
    })
    .remainingAccounts([
      {
        pubkey: randomnessAccount,
        isWritable: false,
        isSigner: false,
      },
      { pubkey: chunkPk, isWritable: true, isSigner: false },
      { pubkey: winnerPk, isWritable: true, isSigner: false },
    ])
    .rpc();

  return { signature: sig, winningTicketId: winningId };
}
