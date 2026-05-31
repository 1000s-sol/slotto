import type { AnchorWallet } from "@solana/wallet-adapter-react";
import { Connection, PublicKey } from "@solana/web3.js";

import { MAX_SOL_TICKETS_PER_BUY } from "./constants";
import type { LotteryDrawView } from "./chain";
import {
  buildBuySolTicketsTransaction,
  preflightBuySolTickets,
  type LotteryVaultPubkeys,
} from "./preflight-buy-sol";
import {
  sendTransactionViaWallet,
  type LotteryWalletSendOpts,
} from "./wallet-send-transaction";

export async function buySolTickets(
  connection: Connection,
  wallet: AnchorWallet,
  programId: PublicKey,
  draw: LotteryDrawView,
  count: number,
  vaults: LotteryVaultPubkeys,
  sendOpts?: LotteryWalletSendOpts,
  nowSec?: number,
): Promise<string> {
  if (!Number.isInteger(count) || count < 1 || count > MAX_SOL_TICKETS_PER_BUY) {
    throw new Error(`Buy 1–${MAX_SOL_TICKETS_PER_BUY} tickets per transaction.`);
  }

  await preflightBuySolTickets(
    connection,
    wallet,
    programId,
    draw,
    count,
    nowSec,
  );

  return sendTransactionViaWallet(
    connection,
    wallet,
    () =>
      buildBuySolTicketsTransaction(
        connection,
        wallet,
        programId,
        draw,
        count,
        vaults,
      ),
    sendOpts,
  );
}
