import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  type Transaction,
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

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");
  const tx = new VersionedTransaction(
    new TransactionMessage({
      payerKey: payer.publicKey,
      recentBlockhash: blockhash,
      instructions: [createIx],
    }).compileToV0Message(),
  );
  tx.sign([payer, randomnessKp]);

  const sig = await connection.sendTransaction(tx, {
    skipPreflight: false,
    maxRetries: 3,
  });
  await connection.confirmTransaction(
    { signature: sig, blockhash, lastValidBlockHeight },
    "confirmed",
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

/**
 * Crossbar "eligible oracle" filtering is what blocked draw #14. If it fails
 * or hangs, commit with an on-chain queue oracle (the path that actually settled).
 */
async function commitIxWithOnChainOracleFallback(
  sb: RandomnessSdk,
  sbProgram: Awaited<
    ReturnType<RandomnessSdk["AnchorUtils"]["loadProgramFromConnection"]>
  >,
  randomness: InstanceType<RandomnessSdk["Randomness"]>,
  queue: PublicKey,
) {
  try {
    return await withTimeout(
      randomness.commitIx(queue),
      15_000,
      "commitIx",
    );
  } catch (e) {
    if (!isOracleSelectionError(e)) {
      console.warn(
        "[switchboard] commitIx failed, trying on-chain oracles:",
        e instanceof Error ? e.message : e,
      );
    }
  }

  const queueAccount = new sb.Queue(sbProgram, queue);
  const oracleKeys: PublicKey[] = await queueAccount.fetchOracleKeys();
  if (oracleKeys.length === 0) {
    throw new Error("Switchboard queue has no on-chain oracles");
  }
  // Prefer oracles whose public gateway responds (assigned host for draw #19
  // is 503 — rebinding to a healthy oracle is the recovery path).
  const orderedKeys = await preferOraclesWithHealthyGateways(
    sb,
    sbProgram,
    oracleKeys,
  );
  const data = await randomness.loadData();
  const authority = data.authority as PublicKey;
  let lastErr: unknown;
  for (let i = 0; i < orderedKeys.length; i += 1) {
    const oracle = orderedKeys[i]!;
    try {
      return await withTimeout(
        randomness.commitIx(queue, authority, oracle),
        20_000,
        `commitIx-oracle-${i}`,
      );
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error("All on-chain Switchboard oracle commits failed");
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
  const healthy: PublicKey[] = [];
  const unknown: PublicKey[] = [];
  for (const key of oracleKeys) {
    try {
      const od = await new Oracle(sbProgram, key).loadData();
      const url = String.fromCharCode(...od.gatewayUri).replace(/\0+$/, "");
      if (!url) {
        unknown.push(key);
        continue;
      }
      const ok = await gatewayResponds(url);
      if (ok) healthy.push(key);
      else unknown.push(key);
    } catch {
      unknown.push(key);
    }
  }
  return [...healthy, ...unknown];
}

async function gatewayResponds(gatewayUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${gatewayUrl.replace(/\/$/, "")}/gateway/api/v1`, {
      method: "GET",
      signal: AbortSignal.timeout(4_000),
    });
    // Any non-network response means the host is up (401/404/405 still fine).
    return res.status !== 502 && res.status !== 503 && res.status !== 504;
  } catch {
    return false;
  }
}

/**
 * Authority recovery: VrfRequested → SalesClosed and clear vrf_request so we
 * can bind a fresh randomness account (e.g. when the assigned oracle gateway
 * is down and cannot sign reveal).
 */
export async function resetDrawVrf(
  program: SlottoLotteryProgram,
  programId: PublicKey,
  authority: Keypair,
  drawPubkey: PublicKey,
): Promise<string> {
  return program.methods
    .resetVrf()
    .accounts({
      authority: authority.publicKey,
      globalConfig: globalConfigPda(programId),
      draw: drawPubkey,
    })
    .signers([authority])
    .rpc();
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

  const commitIx = await commitIxWithOnChainOracleFallback(
    sb,
    sbProgram,
    randomness,
    queue,
  );
  if (!commitIx) {
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

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");

  const tx = new VersionedTransaction(
    new TransactionMessage({
      payerKey: payer.publicKey,
      recentBlockhash: blockhash,
      instructions: [revealIx],
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
