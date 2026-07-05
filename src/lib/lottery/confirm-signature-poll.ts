import type { Connection, SignatureStatus } from "@solana/web3.js";

import { lotteryRpcErrorText } from "./user-facing-error";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function confirmViaGetTransaction(
  connection: Connection,
  signature: string,
): Promise<SignatureConfirmState | null> {
  try {
    const tx = await connection.getTransaction(signature, {
      maxSupportedTransactionVersion: 0,
      commitment: "confirmed",
    });
    if (!tx) return null;
    if (tx.meta?.err) {
      return { kind: "failed", error: JSON.stringify(tx.meta.err) };
    }
    return { kind: "confirmed" };
  } catch {
    return null;
  }
}

export type SignatureConfirmState =
  | { kind: "confirmed" }
  | { kind: "failed"; error: string }
  | { kind: "pending" };

/** Map RPC signature status to confirm / fail / still waiting. */
export function signatureConfirmState(
  value: SignatureStatus | null,
): SignatureConfirmState {
  if (!value) return { kind: "pending" };
  if (value.err) {
    return { kind: "failed", error: JSON.stringify(value.err) };
  }
  const level = value.confirmationStatus;
  if (
    level === "processed" ||
    level === "confirmed" ||
    level === "finalized"
  ) {
    return { kind: "confirmed" };
  }
  // Some RPC nodes omit confirmationStatus briefly after landing.
  if (value.slot != null) {
    return { kind: "confirmed" };
  }
  return { kind: "pending" };
}

export type ConfirmPollResult = {
  confirmed: boolean;
  error: string | null;
};

/** Poll getSignatureStatus until confirmed, on-chain failure, or deadline. */
export async function pollSignatureConfirmation(
  connection: Connection,
  signature: string,
  deadlineMs: number,
  pollIntervalMs = 1500,
): Promise<ConfirmPollResult> {
  const deadline = Date.now() + deadlineMs;
  let lastPollError: string | null = null;
  let pendingPolls = 0;

  while (Date.now() < deadline) {
    try {
      const status = await connection.getSignatureStatus(signature, {
        searchTransactionHistory: true,
      });
      const state = signatureConfirmState(status.value);
      if (state.kind === "confirmed") {
        return { confirmed: true, error: null };
      }
      if (state.kind === "failed") {
        return { confirmed: false, error: state.error };
      }
      pendingPolls += 1;
      if (pendingPolls >= 2) {
        const viaTx = await confirmViaGetTransaction(connection, signature);
        if (viaTx?.kind === "confirmed") {
          return { confirmed: true, error: null };
        }
        if (viaTx?.kind === "failed") {
          return { confirmed: false, error: viaTx.error };
        }
      }
    } catch (e) {
      lastPollError = lotteryRpcErrorText(e);
    }
    await sleep(pollIntervalMs);
  }

  return {
    confirmed: false,
    error: lastPollError ?? "Confirmation timed out",
  };
}
