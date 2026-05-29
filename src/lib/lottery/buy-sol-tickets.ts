import type { AnchorWallet } from "@solana/wallet-adapter-react";
import { Connection, PublicKey } from "@solana/web3.js";

import { MAX_SOL_TICKETS_PER_BUY } from "./constants";
import type { LotteryDrawView } from "./chain";
import { buildBuySolTicketsTransaction, preflightBuySolTickets } from "./preflight-buy-sol";
import {
  sendTransactionViaWallet,
  type WalletSendTransaction,
} from "./wallet-send-transaction";

export async function buySolTickets(
  connection: Connection,
  wallet: AnchorWallet,
  programId: PublicKey,
  draw: LotteryDrawView,
  count: number,
  sendTransaction: WalletSendTransaction,
): Promise<string> {
  if (!Number.isInteger(count) || count < 1 || count > MAX_SOL_TICKETS_PER_BUY) {
    throw new Error(`Buy 1–${MAX_SOL_TICKETS_PER_BUY} tickets per transaction.`);
  }

  await preflightBuySolTickets(connection, wallet, programId, draw, count);

  return sendTransactionViaWallet(
    connection,
    sendTransaction,
    () =>
      buildBuySolTicketsTransaction(
        connection,
        wallet,
        programId,
        draw,
        count,
      ),
    wallet.publicKey,
  );
}
