import type { AnchorWallet } from "@solana/wallet-adapter-react";
import { Connection, PublicKey } from "@solana/web3.js";

import type { LotteryDrawView } from "./chain";
import { DrawState } from "./constants";
import { fetchDrawById } from "./chain";
import { createLotteryProgram } from "./program";

/**
 * Permissionless close + refund for a draw with zero tickets.
 * Any wallet can pay tx fees (no program authority required).
 */
export async function crankEmptyDrawWithWallet(
  connection: Connection,
  wallet: AnchorWallet,
  programId: PublicKey,
  drawId: number,
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
    const sig = await program.methods
      .closeSales()
      .accounts({ draw: draw.draw })
      .rpc();
    signatures.push(sig);
    draw = (await fetchDrawById(connection, programId, drawId))!;
  }

  if (draw.state === DrawState.SalesClosed && draw.totalTickets === 0) {
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
