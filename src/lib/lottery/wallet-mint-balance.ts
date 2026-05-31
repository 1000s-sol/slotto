import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import type { Connection, PublicKey } from "@solana/web3.js";

import {
  buyerAssociatedTokenAddress,
  isLotterySplBuySupportedProgram,
  resolveMintTokenProgram,
} from "./mint-token-program";

export type WalletMintBalanceSnapshot = {
  /** Balance in the buyer ATA used by `buy_spl_tickets` (legacy SPL only). */
  amount: string;
  /** Sum across all token accounts for this mint (matches wallet UI). */
  totalAmount: string;
  decimals: number;
  ata: string;
  /** Whether this mint can be used for on-chain SPL ticket buys. */
  lotteryBuySupported: boolean;
};

function parsedAmount(account: {
  data: { parsed?: { info?: { tokenAmount?: { amount?: string; decimals?: number } } } };
}): { amount: bigint; decimals: number } | null {
  const tokenAmount = account.data.parsed?.info?.tokenAmount;
  if (!tokenAmount?.amount) return null;
  try {
    return {
      amount: BigInt(tokenAmount.amount),
      decimals: tokenAmount.decimals ?? 0,
    };
  } catch {
    return null;
  }
}

/** Read SPL balances via server RPC (ATA + wallet total for mint). */
export async function fetchWalletMintBalance(
  connection: Connection,
  owner: PublicKey,
  mint: PublicKey,
): Promise<WalletMintBalanceSnapshot> {
  const tokenProgram =
    (await resolveMintTokenProgram(connection, mint)) ?? TOKEN_PROGRAM_ID;
  const lotteryBuySupported = isLotterySplBuySupportedProgram(tokenProgram);
  const ata = buyerAssociatedTokenAddress(mint, owner, tokenProgram);

  let total = BigInt(0);
  let decimals = 0;
  let ataAmount = BigInt(0);

  const parsed = await connection.getParsedTokenAccountsByOwner(
    owner,
    { mint },
    "confirmed",
  );

  for (const { pubkey, account } of parsed.value) {
    const row = parsedAmount(account);
    if (!row) continue;
    total += row.amount;
    decimals = row.decimals;
    if (pubkey.equals(ata)) {
      ataAmount = row.amount;
    }
  }

  if (parsed.value.length === 0 && lotteryBuySupported) {
    try {
      const bal = await connection.getTokenAccountBalance(ata, "confirmed");
      ataAmount = BigInt(bal.value.amount);
      total = ataAmount;
      decimals = bal.value.decimals;
    } catch {
      // No token account yet — leave zeros.
    }
  } else if (ataAmount === BigInt(0) && lotteryBuySupported) {
    try {
      const bal = await connection.getTokenAccountBalance(ata, "confirmed");
      ataAmount = BigInt(bal.value.amount);
    } catch {
      // ATA missing while other accounts hold balance — total still reflects wallet UI.
    }
  }

  return {
    amount: ataAmount.toString(),
    totalAmount: total.toString(),
    decimals,
    ata: ata.toBase58(),
    lotteryBuySupported,
  };
}
