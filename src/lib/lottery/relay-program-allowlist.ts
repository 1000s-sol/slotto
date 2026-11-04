import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  PublicKey,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";

import { lotteryProgramId } from "./config";

/** Compute Budget program — some wallets prepend priority-fee ixs. */
const COMPUTE_BUDGET_PROGRAM_ID = new PublicKey(
  "ComputeBudget111111111111111111111111111111",
);

/**
 * Top-level programs allowed on public simulate / send-transaction relays.
 *
 * Ticket buys only expose lottery (+ optional ATA create + compute budget) as
 * top-level instructions. Token / System transfers happen via CPI from the
 * lottery program, so they must not be allowlisted at the top level (that
 * would turn the relay into a generic fee-payer-anonymous broadcaster).
 */
export function lotteryRelayAllowedProgramIds(): Set<string> {
  return new Set([
    lotteryProgramId().toBase58(),
    ASSOCIATED_TOKEN_PROGRAM_ID.toBase58(),
    COMPUTE_BUDGET_PROGRAM_ID.toBase58(),
  ]);
}

export type RelayTxValidation =
  | { ok: true }
  | { ok: false; error: string };

function programIdsFromLegacy(raw: Buffer): PublicKey[] | null {
  try {
    const tx = Transaction.from(raw);
    return tx.instructions.map((ix) => ix.programId);
  } catch {
    return null;
  }
}

function programIdsFromVersioned(raw: Buffer): PublicKey[] | null {
  try {
    const tx = VersionedTransaction.deserialize(raw);
    const keys = tx.message.getAccountKeys();
    return tx.message.compiledInstructions.map((ix) => {
      const pk = keys.get(ix.programIdIndex);
      if (!pk) {
        throw new Error("missing program id");
      }
      return pk;
    });
  } catch {
    return null;
  }
}

/**
 * Reject empty txs and any top-level program outside the lottery buy allowlist.
 * Requires at least one instruction that targets the lottery program.
 */
export function validateLotteryRelayTransaction(raw: Buffer): RelayTxValidation {
  if (raw.length < 64 || raw.length > 1644) {
    return { ok: false, error: "Invalid transaction size" };
  }

  const programIds =
    programIdsFromLegacy(raw) ?? programIdsFromVersioned(raw);
  if (!programIds) {
    return { ok: false, error: "Could not decode transaction" };
  }
  if (programIds.length === 0) {
    return { ok: false, error: "Transaction has no instructions" };
  }

  const allowed = lotteryRelayAllowedProgramIds();
  const lottery = lotteryProgramId().toBase58();
  let hasLotteryIx = false;

  for (const programId of programIds) {
    const id = programId.toBase58();
    if (!allowed.has(id)) {
      return {
        ok: false,
        error: "Transaction targets a program that is not allowed",
      };
    }
    if (id === lottery) hasLotteryIx = true;
  }

  if (!hasLotteryIx) {
    return {
      ok: false,
      error: "Transaction must include a lottery program instruction",
    };
  }

  return { ok: true };
}
