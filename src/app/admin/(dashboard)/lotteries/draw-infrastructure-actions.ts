"use server";

import { PublicKey } from "@solana/web3.js";

import { fetchDrawById } from "@/lib/lottery/chain";
import { lotteryProgramId } from "@/lib/lottery/config";
import { DrawState } from "@/lib/lottery/constants";
import {
  ensureDrawReadyForSales,
  ensureTicketChunksForPurchase,
} from "@/lib/lottery/ensure-draw-ready";
import {
  keypairToAnchorWallet,
  loadLotteryKeeperKeypair,
} from "@/lib/lottery/keeper-wallet";
import { withLotteryServerRpc } from "@/lib/lottery/server-rpc";
import { globalConfigPda } from "@/lib/lottery/pdas";
import { createLotteryReadOnlyProgram } from "@/lib/lottery/program";

/** After create_draw: team ATAs for all SPL mints + ticket chunk 1 (next 256 batch). */
export async function adminPrepareNewDrawInfrastructureAction(
  drawId: number,
  splMints: string[],
): Promise<{ ok: true; teamAta: number; chunks: number } | { ok: false; error: string }> {
  const payer = loadLotteryKeeperKeypair();
  if (!payer) {
    return { ok: false, error: "LOTTERY_KEEPER_SECRET_KEY not configured on server" };
  }

  try {
    return await withLotteryServerRpc(async (connection) => {
      const programId = lotteryProgramId();
      const draw = await fetchDrawById(connection, programId, drawId);
      if (!draw) return { ok: false, error: `Draw #${drawId} not found` };

      const program = createLotteryReadOnlyProgram(connection);
      const cfg = await program.account.globalConfig.fetch(globalConfigPda(programId));
      if (!cfg.authority.equals(payer.publicKey)) {
        return {
          ok: false,
          error: "Keeper wallet is not the on-chain lottery authority",
        };
      }

      const wallet = keypairToAnchorWallet(payer);
      const mintPks = splMints
        .map((m) => m.trim())
        .filter(Boolean)
        .map((m) => new PublicKey(m));

      const { teamAtaSigs, chunkSigs } = await ensureDrawReadyForSales(
        connection,
        wallet,
        programId,
        draw,
        {
          splMints: mintPks,
          chunkIndices: [1],
        },
      );

      return {
        ok: true,
        teamAta: teamAtaSigs.length,
        chunks: chunkSigs.length,
      };
    });
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "prepare draw failed",
    };
  }
}

/** Before a ticket buy: init any missing ticket-chunk PDAs for this purchase. */
export async function ensureTicketChunksForPurchaseAction(
  drawId: number,
  count: number,
): Promise<{ ok: true; inited: number } | { ok: false; error: string }> {
  if (!Number.isInteger(drawId) || drawId < 0) {
    return { ok: false, error: "Invalid draw id" };
  }
  if (!Number.isInteger(count) || count < 1) {
    return { ok: false, error: "Invalid ticket count" };
  }

  const payer = loadLotteryKeeperKeypair();
  if (!payer) {
    return { ok: false, error: "Keeper not configured" };
  }

  try {
    return await withLotteryServerRpc(async (connection) => {
      const programId = lotteryProgramId();
      const draw = await fetchDrawById(connection, programId, drawId);
      if (!draw) return { ok: false, error: "Draw not found" };
  if (draw.state !== DrawState.Selling) {
    return { ok: false, error: "Draw is not selling" };
  }

  const program = createLotteryReadOnlyProgram(connection);
  const cfg = await program.account.globalConfig.fetch(globalConfigPda(programId));
  if (!cfg.authority.equals(payer.publicKey)) {
    // Keeper is not authority — chunks must be inited at create_draw time by admin.
    return { ok: true, inited: 0 };
  }

  const wallet = keypairToAnchorWallet(payer);
      const sigs = await ensureTicketChunksForPurchase(
        connection,
        wallet,
        programId,
        draw,
        count,
      );
      return { ok: true, inited: sigs.length };
    });
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "chunk init failed",
    };
  }
}
