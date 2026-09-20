import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SYSVAR_CLOCK_PUBKEY,
} from "@solana/web3.js";

import { fetchDrawById } from "./chain";
import { DrawState, VRF_STUB_MARKER } from "./constants";
import { globalConfigPda, ticketChunkPda } from "./pdas";
import { createLotteryReadOnlyProgram } from "./program";
import type { SlottoLotteryProgram } from "./program";
import { forceSettleDraw } from "./force-settle";
import {
  createDrawRandomnessAccount,
  isAssignedOracleGatewayDown,
  isFreshUncommittedRandomness,
  isInvalidQuoteError,
  isOracleSelectionError,
  requestSwitchboardVrf,
  resetDrawVrf,
  revealSwitchboardVrf,
  settleDrawWithSwitchboard,
} from "./switchboard-crank";
import {
  stubWinningTicketId,
  ticketChunkIndex,
  ticketSlotInChunk,
} from "./stub-settle";
import { lotteryVrfMode } from "./vrf-mode";
import {
  getStoredDrawRandomness,
  storeDrawRandomness,
} from "./draw-randomness-db";

const STATE_NAMES = [
  "Selling",
  "SalesClosed",
  "VrfRequested",
  "Settled",
  "Refunded",
] as const;

/** Abort RandomnessInit below this so cron cannot drain the keeper. */
const MIN_KEEPER_LAMPORTS_FOR_CREATE = Math.floor(0.05 * LAMPORTS_PER_SOL);

/**
 * One dead-gateway reset per draw per short window. Prevents concurrent admin
 * Settle + cron from double-resetting in the same second. Do NOT use a long
 * cooldown: draw #20 rebound to the same 503 oracle and a 2-minute lock left
 * Settle stuck.
 */
const deadGatewayRecoveryAt = new Map<number, number>();
const DEAD_GATEWAY_RECOVERY_COOLDOWN_MS = 15_000;

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

/**
 * When the assigned Switchboard oracle gateway is down, reset_vrf + fresh
 * RandomnessInit (healthy oracle preferred at commit) + request_vrf.
 * Returns true if recovery txs were sent. Cooldown prevents burn loops.
 */
async function tryRecoverDeadOracleGateway(opts: {
  connection: Connection;
  program: SlottoLotteryProgram;
  programId: PublicKey;
  drawId: number;
  drawPubkey: PublicKey;
  keeper: Keypair;
  randomnessAccount: PublicKey;
  actions: string[];
  signatures: string[];
}): Promise<boolean> {
  const {
    connection,
    program,
    programId,
    drawId,
    drawPubkey,
    keeper,
    randomnessAccount,
    actions,
    signatures,
  } = opts;

  const last = deadGatewayRecoveryAt.get(drawId) ?? 0;
  if (Date.now() - last < DEAD_GATEWAY_RECOVERY_COOLDOWN_MS) {
    actions.push(
      `dead-gateway recovery cooldown (${Math.ceil(
        (DEAD_GATEWAY_RECOVERY_COOLDOWN_MS - (Date.now() - last)) / 1000,
      )}s left)`,
    );
    return false;
  }

  const { down, gatewayUrl } = await isAssignedOracleGatewayDown(
    connection,
    keeper,
    randomnessAccount,
  );
  if (!down) {
    return false;
  }

  // Stamp cooldown before txs so concurrent cranks do not double-reset.
  deadGatewayRecoveryAt.set(drawId, Date.now());

  actions.push(
    `oracle gateway down (${gatewayUrl || "unknown"}) — reset_vrf + re-request`,
  );
  try {
    const resetSig = await resetDrawVrf(
      program,
      programId,
      keeper,
      drawPubkey,
    );
    signatures.push(resetSig);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const after = await fetchDrawById(connection, programId, drawId);
    if (after?.state === DrawState.SalesClosed) {
      actions.push(
        `reset_vrf already applied (concurrent) — ${msg.slice(0, 80)}`,
      );
    } else if (after?.state === DrawState.VrfRequested) {
      // Likely unauthorized or transient; do not create another randomness.
      deadGatewayRecoveryAt.delete(drawId);
      throw e;
    } else {
      actions.push(`reset_vrf skipped (${msg.slice(0, 80)})`);
      return false;
    }
  }

  // Another crank may have already re-requested while we raced.
  {
    const afterReset = await fetchDrawById(connection, programId, drawId);
    if (afterReset?.state === DrawState.VrfRequested) {
      actions.push(
        "already VrfRequested after reset race — next pass will reveal + settle",
      );
      return true;
    }
    if (afterReset?.state !== DrawState.SalesClosed) {
      return false;
    }
  }

  const keeperLamports = await connection.getBalance(
    keeper.publicKey,
    "confirmed",
  );
  if (keeperLamports < MIN_KEEPER_LAMPORTS_FOR_CREATE) {
    throw new Error(
      `Keeper underfunded for Switchboard RandomnessInit after reset_vrf (${keeperLamports} lamports, need ${MIN_KEEPER_LAMPORTS_FOR_CREATE}).`,
    );
  }

  actions.push("create_switchboard_randomness (dead-gateway recovery)");
  const freshRandomness = await createDrawRandomnessAccount(
    connection,
    keeper,
  );
  await storeDrawRandomness(drawId, freshRandomness.toBase58());
  actions.push(
    `stored_switchboard_randomness ${freshRandomness.toBase58()}`,
  );

  actions.push("commit_vrf + request_vrf (dead-gateway recovery)");
  const reqSig = await requestSwitchboardVrf(
    connection,
    program,
    keeper,
    drawPubkey,
    freshRandomness,
  );
  signatures.push(reqSig);

  const check = await isAssignedOracleGatewayDown(
    connection,
    keeper,
    freshRandomness,
  );
  if (check.down) {
    // Commit still picked a dead host — leave VrfRequested so the next Settle
    // pass resets again (healthy-oracle-first commit should fix this).
    deadGatewayRecoveryAt.delete(drawId);
    throw new Error(
      `Recovery re-bound dead Switchboard gateway (${check.gatewayUrl || "unknown"}). Click Settle again.`,
    );
  }
  return true;
}

/** Switchboard randomness pubkey for reveal/settle (session → on-chain draw → env override). */
function resolveSwitchboardRandomnessAccount(
  draw: { vrfRequest: PublicKey },
  sessionRandomness: PublicKey | null,
): PublicKey | null {
  const envOverride = process.env.LOTTERY_RANDOMNESS_ACCOUNT?.trim();
  if (envOverride) {
    return new PublicKey(envOverride);
  }
  if (sessionRandomness) {
    return sessionRandomness;
  }
  const onChain = draw.vrfRequest;
  if (
    !onChain.equals(PublicKey.default) &&
    !onChain.equals(VRF_STUB_MARKER)
  ) {
    return onChain;
  }
  return null;
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
  keeper?: Keypair,
): Promise<CrankDrawResult> {
  let draw = await fetchDrawById(connection, programId, drawId);
  if (!draw) {
    throw new Error(`Draw #${drawId} not found`);
  }

  const actions: string[] = [];
  const signatures: string[] = [];
  const initialState = stateLabel(draw.state);
  let switchboardRandomness: PublicKey | null = null;

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
    } else if (lotteryVrfMode() === "switchboard") {
      if (!keeper) {
        throw new Error(
          "Switchboard VRF crank requires keeper Keypair (pass to crankDraw).",
        );
      }
      // Switchboard announced wind-down (2026-09-19): Crossbar often has zero
      // eligible oracles. Prefer authority force_settle when the upgraded
      // program is deployed; otherwise fall through to Switchboard.
      try {
        actions.push("force_settle (authority emergency path)");
        const { signature, winningTicketId } = await forceSettleDraw(
          connection,
          program,
          programId,
          keeper,
          drawId,
        );
        signatures.push(signature);
        actions.push(`force_settle winning ticket #${winningTicketId}`);
        draw = (await fetchDrawById(connection, programId, drawId))!;
        return {
          drawId,
          initialState,
          finalState: stateLabel(draw.state),
          actions,
          signatures,
          winner: draw.winner,
          winningTicketId: draw.winningTicketId,
        };
      } catch (fe) {
        const feMsg = fe instanceof Error ? fe.message : String(fe);
        actions.push(
          `force_settle unavailable (${feMsg.slice(0, 120)}) — trying Switchboard`,
        );
      }
      /**
       * Prefer a fresh unused Randomness account. Reusing a prior commit that
       * bound a dead oracle (draw #20) makes Crossbar report "no eligible"
       * and leaves Settle stuck in SalesClosed.
       */
      const existing =
        process.env.LOTTERY_RANDOMNESS_ACCOUNT?.trim() ||
        (await getStoredDrawRandomness(drawId));
      let reuseOk = false;
      if (existing) {
        const pk = new PublicKey(existing);
        const fresh = await isFreshUncommittedRandomness(
          connection,
          keeper,
          pk,
        );
        if (fresh) {
          switchboardRandomness = pk;
          reuseOk = true;
          actions.push(`reuse_switchboard_randomness ${existing}`);
        } else {
          actions.push(
            `skip_stale_switchboard_randomness ${existing} (already committed or unreadable)`,
          );
        }
      }
      if (!reuseOk) {
        const keeperLamports = await connection.getBalance(
          keeper.publicKey,
          "confirmed",
        );
        if (keeperLamports < MIN_KEEPER_LAMPORTS_FOR_CREATE) {
          throw new Error(
            `Keeper underfunded for Switchboard RandomnessInit (${keeperLamports} lamports, need ${MIN_KEEPER_LAMPORTS_FOR_CREATE}). Refusing to create another account.`,
          );
        }
        actions.push("create_switchboard_randomness");
        switchboardRandomness = await createDrawRandomnessAccount(
          connection,
          keeper,
        );
        await storeDrawRandomness(
          drawId,
          switchboardRandomness.toBase58(),
        );
        actions.push(
          `stored_switchboard_randomness ${switchboardRandomness.toBase58()}`,
        );
      }
      if (!switchboardRandomness) {
        throw new Error("Switchboard randomness account missing after create/reuse");
      }
      actions.push("commit_vrf + request_vrf");
      try {
        const reqSig = await requestSwitchboardVrf(
          connection,
          program,
          keeper,
          draw.draw,
          switchboardRandomness,
        );
        signatures.push(reqSig);
      } catch (e) {
        // Switchboard mainnet has no eligible oracles (network wind-down).
        // Authority force_settle pays the winner without VRF.
        if (isOracleSelectionError(e) || isInvalidQuoteError(e)) {
          actions.push(
            `switchboard unavailable (${e instanceof Error ? e.message.slice(0, 80) : "error"}) — force_settle`,
          );
          const { signature, winningTicketId } = await forceSettleDraw(
            connection,
            program,
            programId,
            keeper,
            drawId,
          );
          signatures.push(signature);
          actions.push(`force_settle winning ticket #${winningTicketId}`);
          draw = (await fetchDrawById(connection, programId, drawId))!;
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
        throw e;
      }
    } else {
      actions.push("request_vrf (stub)");
      const sig = await program.methods
        .requestVrf()
        .accounts({ draw: draw.draw })
        .rpc();
      signatures.push(sig);
    }
    draw = (await fetchDrawById(connection, programId, drawId))!;
    // Do not settle in the same pass — oracle needs a few seconds after commit.
    // Falling through immediately caused "not resolved" → false gateway-down →
    // reset_vrf loops that wiped VrfRequested (draw #20).
    if (draw.state === DrawState.VrfRequested) {
      actions.push("vrf requested — next pass will reveal + settle");
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
  }

  if (draw.state === DrawState.VrfRequested) {
    if (lotteryVrfMode() === "switchboard") {
      if (!keeper) {
        throw new Error(
          "Switchboard VRF crank requires keeper Keypair (pass to crankDraw).",
        );
      }
      try {
        actions.push("force_settle (authority emergency path)");
        const { signature, winningTicketId } = await forceSettleDraw(
          connection,
          program,
          programId,
          keeper,
          drawId,
        );
        signatures.push(signature);
        actions.push(`force_settle winning ticket #${winningTicketId}`);
        draw = (await fetchDrawById(connection, programId, drawId))!;
        return {
          drawId,
          initialState,
          finalState: stateLabel(draw.state),
          actions,
          signatures,
          winner: draw.winner,
          winningTicketId: draw.winningTicketId,
        };
      } catch (fe) {
        const feMsg = fe instanceof Error ? fe.message : String(fe);
        actions.push(
          `force_settle unavailable (${feMsg.slice(0, 120)}) — trying Switchboard reveal`,
        );
      }
      const randomnessAccount = resolveSwitchboardRandomnessAccount(
        draw,
        switchboardRandomness,
      );
      if (!randomnessAccount) {
        throw new Error(
          "Missing randomness account for Switchboard settle. Draw has no Switchboard vrf_request on-chain; re-run from SalesClosed or set LOTTERY_RANDOMNESS_ACCOUNT.",
        );
      }
      // Reveal is best-effort: Switchboard oracles often auto-reveal the
      // randomness account after commit, in which case the SDK reveal throws
      // ("Invalid account discriminator" / already revealed). `settle` reads
      // the revealed value directly on-chain and fails cleanly only if it is
      // genuinely unresolved, so a reveal error must not block settlement.
      let revealGatewayFailed = false;
      try {
        actions.push("reveal_vrf");
        const revealSig = await revealSwitchboardVrf(
          connection,
          keeper,
          randomnessAccount,
        );
        signatures.push(revealSig);
      } catch (e) {
        const revealMsg = e instanceof Error ? e.message : String(e);
        revealGatewayFailed =
          /gateway|503|err_bad_response|fetchrandomnessreveal/i.test(
            revealMsg,
          );
        actions.push(`reveal_vrf skipped (${revealMsg.slice(0, 160)})`);
      }
      actions.push("settle (switchboard)");
      try {
        const { signature, winningTicketId } = await settleDrawWithSwitchboard(
          connection,
          program,
          programId,
          drawId,
          randomnessAccount,
        );
        signatures.push(signature);
        actions.push(`winning ticket #${winningTicketId}`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const lower = msg.toLowerCase();
        const unresolved =
          lower.includes("not resolved yet") ||
          lower.includes("not ready to reveal") ||
          lower.includes("randomness value missing") ||
          lower.includes("randomness not resolved") ||
          lower.includes("invalidsecpsignature") ||
          lower.includes("invalid secp") ||
          lower.includes("dead switchboard gateway") ||
          lower.includes("re-bound dead") ||
          revealGatewayFailed;

        // Assigned oracle gateway 503: other hosts return InvalidSecpSignature.
        // Reset once (cooldown), bind a fresh randomness account to a healthy
        // oracle, re-request — next pass reveals + settles.
        if (unresolved) {
          try {
            const recovered = await tryRecoverDeadOracleGateway({
              connection,
              program,
              programId,
              drawId,
              drawPubkey: draw.draw,
              keeper,
              randomnessAccount,
              actions,
              signatures,
            });
            draw = (await fetchDrawById(connection, programId, drawId))!;
            if (recovered) {
              actions.push(
                "dead-gateway recovery requested — next pass will reveal + settle",
              );
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
          } catch (re) {
            const reMsg = re instanceof Error ? re.message : String(re);
            actions.push(`dead-gateway recovery failed (${reMsg.slice(0, 160)})`);
            // Switchboard cannot recover — authority force_settle.
            try {
              actions.push("force_settle after failed Switchboard recovery");
              const { signature, winningTicketId } = await forceSettleDraw(
                connection,
                program,
                programId,
                keeper,
                drawId,
              );
              signatures.push(signature);
              actions.push(`force_settle winning ticket #${winningTicketId}`);
              draw = (await fetchDrawById(connection, programId, drawId))!;
              return {
                drawId,
                initialState,
                finalState: stateLabel(draw.state),
                actions,
                signatures,
                winner: draw.winner,
                winningTicketId: draw.winningTicketId,
              };
            } catch (fe) {
              actions.push(
                `force_settle failed (${fe instanceof Error ? fe.message.slice(0, 120) : "error"})`,
              );
            }
            draw = (await fetchDrawById(connection, programId, drawId))!;
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
        }

        actions.push(`settle waiting (${msg.slice(0, 160)})`);
        draw = (await fetchDrawById(connection, programId, drawId))!;
        if (
          unresolved ||
          lower.includes("is not vrfrequested") ||
          lower.includes("gateway")
        ) {
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
        throw e;
      }
    } else {
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

      actions.push(`settle (stub ticket #${winningId})`);
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
    }
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
  keeper?: Keypair,
): Promise<CrankDrawResult[]> {
  const ids = await fetchDrawIdsNeedingCrank(connection, programId);
  const results: CrankDrawResult[] = [];
  for (const drawId of ids) {
    results.push(
      await crankDraw(connection, program, programId, drawId, keeper),
    );
  }
  return results;
}
