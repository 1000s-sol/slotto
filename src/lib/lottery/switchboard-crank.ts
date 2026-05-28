import {
  Connection,
  Keypair,
  PublicKey,
  type Transaction,
  TransactionMessage,
  type VersionedTransaction as Web3VersionedTransaction,
  VersionedTransaction,
} from "@solana/web3.js";

import { fetchDrawById } from "./chain";
import { DrawState } from "./constants";
import { ticketChunkPda } from "./pdas";
import type { SlottoLotteryProgram } from "./program";
import { switchboardQueueForCluster } from "./switchboard-config";
import {
  ticketChunkIndex,
  ticketSlotInChunk,
} from "./stub-settle";
import { winningTicketFromVrfBytes } from "./winning-ticket-from-vrf";

type RandomnessSdk = typeof import("@switchboard-xyz/on-demand");

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
  const rng = await Randomness.create(sbProgram, {
    queue: queue,
    authority: payer.publicKey,
  });
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

  const commitIx = await randomness.commitIx(queue);
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

/** Reveal Switchboard randomness (run after commit/request, before settle). */
export async function revealSwitchboardVrf(
  connection: Connection,
  payer: Keypair,
  randomnessAccount: PublicKey,
): Promise<string> {
  const sb = await loadSwitchboardSdk();
  const { AnchorUtils, Randomness } = sb;
  const sbProgram = await AnchorUtils.loadProgramFromConnection(
    connection,
    switchboardWalletFromKeypair(payer),
  );
  const randomness = new Randomness(sbProgram, randomnessAccount);

  const revealIx = await randomness.revealIx();
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
  const sb = await loadSwitchboardSdk();
  const parsed = sb.RandomnessAccountData.parse(account.data);
  const slot = await connection.getSlot("confirmed");
  const value = parsed.getValue(slot);
  return winningTicketFromVrfBytes(Buffer.from(value), totalTickets);
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
