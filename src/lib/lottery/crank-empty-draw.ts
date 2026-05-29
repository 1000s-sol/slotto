import type { AnchorWallet } from "@solana/wallet-adapter-react";
import { Connection, PublicKey } from "@solana/web3.js";

import type { LotteryDrawView } from "./chain";
import { DrawState } from "./constants";
import { fetchDrawById } from "./chain";
import { createLotteryProgram } from "./program";
import {
  sendTransactionViaWallet,
  type WalletSendTransaction,
} from "./wallet-send-transaction";

/**
 * Permissionless close + refund for a draw with zero tickets.
 * Any wallet can pay tx fees (no program authority required).
 */
export async function crankEmptyDrawWithWallet(
  connection: Connection,
  wallet: AnchorWallet,
  programId: PublicKey,
  drawId: number,
  sendTransaction: WalletSendTransaction,
): Promise<string[]> {
  const signatures: string[] = [];
  const program = createLotteryProgram(connection, wallet);

  let draw = await fetchDrawById(connection, programId, drawId);
  if (!draw) throw new Error(`Draw #${drawId} not found`);

  if (
    draw.state === DrawState.Settled ||
    draw.state === DrawState.Refunded
  ) {
    return signatures;
  }

  if (draw.state === DrawState.Selling) {
    const drawPk = draw.draw;
    const sig = await sendTransactionViaWallet(connection, sendTransaction, () =>
      program.methods.closeSales().accounts({ draw: drawPk }).transaction(),
    );
    signatures.push(sig);
    const refreshed = await fetchDrawById(connection, programId, drawId);
    if (!refreshed) throw new Error(`Draw #${drawId} not found after close_sales`);
    draw = refreshed;
  }

  if (draw.state === DrawState.SalesClosed && draw.totalTickets === 0) {
    const drawPk = draw.draw;
    const prizeVault = draw.prizeVault;
    const acct = await program.account.draw.fetch(drawPk);
    const seedRefund = acct.seedRefund;
    const sig = await sendTransactionViaWallet(connection, sendTransaction, () =>
      program.methods
        .refundEmptyDraw()
        .accounts({
          draw: drawPk,
          prizeVault,
          seedRefund,
        })
        .transaction(),
    );
    signatures.push(sig);
  }

  return signatures;
}

export function drawNeedsEmptyRefund(draw: LotteryDrawView): boolean {
  if (draw.totalTickets > 0) return false;
  return (
    draw.state === DrawState.SalesClosed ||
    draw.state === DrawState.Selling
  );
}
