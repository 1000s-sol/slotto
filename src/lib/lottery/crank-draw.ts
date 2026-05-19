import { Connection, PublicKey, SYSVAR_CLOCK_PUBKEY } from "@solana/web3.js";

import { fetchDrawById } from "./chain";
import { DrawState } from "./constants";
import { globalConfigPda, ticketChunkPda } from "./pdas";
import { createLotteryReadOnlyProgram } from "./program";
import type { SlottoLotteryProgram } from "./program";
import {
  stubWinningTicketId,
  ticketChunkIndex,
  ticketSlotInChunk,
} from "./stub-settle";

const STATE_NAMES = [
  "Selling",
  "SalesClosed",
  "VrfRequested",
  "Settled",
  "Refunded",
] as const;

export type CrankDrawResult = {
  drawId: number;
  initialState: string;
  finalState: string;
  actions: string[];
  signatures: string[];
  winner: string | null;
  winningTicketId: number;
};

function stateLabel(state: number): string {
  return STATE_NAMES[state] ?? `unknown(${state})`;
}

/** Draws that still need permissionless lifecycle txs after sales end. */
export async function fetchDrawIdsNeedingCrank(
  connection: Connection,
  programId: PublicKey,
): Promise<number[]> {
  const program = createLotteryReadOnlyProgram(connection);
  const cfg = await program.account.globalConfig.fetch(
    globalConfigPda(programId),
  );
  const n = Number(cfg.nextDrawId);
  const clockInfo = await connection.getAccountInfo(SYSVAR_CLOCK_PUBKEY);
  const nowSec =
    clockInfo && clockInfo.data.length >= 40
      ? Number(clockInfo.data.readBigInt64LE(32))
      : 0;

  const ids: number[] = [];
  for (let drawId = 0; drawId < n; drawId += 1) {
    const draw = await fetchDrawById(connection, programId, drawId);
    if (!draw) continue;
    if (draw.state === DrawState.SalesClosed || draw.state === DrawState.VrfRequested) {
      ids.push(drawId);
      continue;
    }
    if (
      draw.state === DrawState.Selling &&
      nowSec >= draw.salesCloseTs
    ) {
      ids.push(drawId);
    }
  }
  return ids;
}

/** Run `close_sales` → `request_vrf` / `refund_empty_draw` → `settle` for one draw. */
export async function crankDraw(
  connection: Connection,
  program: SlottoLotteryProgram,
  programId: PublicKey,
  drawId: number,
): Promise<CrankDrawResult> {
  let draw = await fetchDrawById(connection, programId, drawId);
  if (!draw) {
    throw new Error(`Draw #${drawId} not found`);
  }

  const actions: string[] = [];
  const signatures: string[] = [];
  const initialState = stateLabel(draw.state);

  if (draw.state === DrawState.Settled || draw.state === DrawState.Refunded) {
    return {
      drawId,
      initialState,
      finalState: initialState,
      actions: ["noop"],
      signatures: [],
      winner: draw.winner,
      winningTicketId: draw.winningTicketId,
    };
  }

  if (draw.state === DrawState.Selling) {
    actions.push("close_sales");
    const sig = await program.methods
      .closeSales()
      .accounts({ draw: draw.draw })
      .rpc();
    signatures.push(sig);
    draw = (await fetchDrawById(connection, programId, drawId))!;
  }

  if (draw.state === DrawState.SalesClosed) {
    if (draw.totalTickets === 0) {
      actions.push("refund_empty_draw");
      const acct = await program.account.draw.fetch(draw.draw);
      const sig = await program.methods
        .refundEmptyDraw()
        .accounts({
          draw: draw.draw,
          prizeVault: draw.prizeVault,
          seedRefund: acct.seedRefund,
        })
        .rpc();
      signatures.push(sig);
    } else {
      actions.push("request_vrf");
      const sig = await program.methods
        .requestVrf()
        .accounts({ draw: draw.draw })
        .rpc();
      signatures.push(sig);
    }
    draw = (await fetchDrawById(connection, programId, drawId))!;
  }

  if (draw.state === DrawState.VrfRequested) {
    const clockInfo = await connection.getAccountInfo(SYSVAR_CLOCK_PUBKEY);
    if (!clockInfo || clockInfo.data.length < 40) {
      throw new Error("Could not read clock sysvar");
    }
    const slot = clockInfo.data.readBigUInt64LE(0);
    const unixTs = clockInfo.data.readBigInt64LE(32);

    const winningId = stubWinningTicketId(
      draw.draw,
      slot,
      unixTs,
      draw.totalTickets,
    );
    const chunkIdx = ticketChunkIndex(winningId);
    const slotInChunk = ticketSlotInChunk(winningId);
    const chunkPk = ticketChunkPda(programId, draw.draw, chunkIdx);
    const chunk = await program.account.ticketChunk.fetch(chunkPk);
    const winnerPk = chunk.owners[slotInChunk];

    actions.push(`settle (ticket #${winningId})`);
    const sig = await program.methods
      .settle()
      .accounts({
        draw: draw.draw,
        prizeVault: draw.prizeVault,
      })
      .remainingAccounts([
        { pubkey: chunkPk, isWritable: true, isSigner: false },
        { pubkey: winnerPk, isWritable: true, isSigner: false },
      ])
      .rpc();
    signatures.push(sig);
    draw = (await fetchDrawById(connection, programId, drawId))!;
  }

  return {
    drawId,
    initialState,
    finalState: stateLabel(draw.state),
    actions,
    signatures,
    winner: draw.winner,
    winningTicketId: draw.winningTicketId,
  };
}

export async function crankAllPendingDraws(
  connection: Connection,
  program: SlottoLotteryProgram,
  programId: PublicKey,
): Promise<CrankDrawResult[]> {
  const ids = await fetchDrawIdsNeedingCrank(connection, programId);
  const results: CrankDrawResult[] = [];
  for (const drawId of ids) {
    results.push(await crankDraw(connection, program, programId, drawId));
  }
  return results;
}
