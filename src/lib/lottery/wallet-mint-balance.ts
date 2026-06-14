import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import type { Connection, PublicKey } from "@solana/web3.js";

import {
  buyerAssociatedTokenAddress,
  isLotterySplBuySupportedProgram,
  resolveMintTokenProgram,
} from "./mint-token-program";
import { isRpcRateLimitError } from "./rpc-url";

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

async function readLegacyAtaBalance(
  connection: Connection,
  legacyAta: PublicKey,
): Promise<{ amount: bigint; decimals: number } | null> {
  try {
    const bal = await connection.getTokenAccountBalance(legacyAta, "confirmed");
    return {
      amount: BigInt(bal.value.amount),
      decimals: bal.value.decimals,
    };
  } catch {
    return null;
  }
}

async function readBalancesOnce(
  connection: Connection,
  owner: PublicKey,
  mint: PublicKey,
  legacyAta: PublicKey,
  lotteryBuySupported: boolean,
): Promise<{ total: bigint; ataAmount: bigint; decimals: number }> {
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
    if (pubkey.equals(legacyAta)) {
      ataAmount = row.amount;
    }
  }

  if (lotteryBuySupported && (parsed.value.length === 0 || ataAmount === BigInt(0))) {
    const direct = await readLegacyAtaBalance(connection, legacyAta);
    if (direct) {
      if (ataAmount === BigInt(0)) ataAmount = direct.amount;
      if (total === BigInt(0)) total = direct.amount;
      if (decimals === 0) decimals = direct.decimals;
    }
  }

  return { total, ataAmount, decimals };
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
  const legacyAta = buyerAssociatedTokenAddress(mint, owner, TOKEN_PROGRAM_ID);

  let total = BigInt(0);
  let decimals = 0;
  let ataAmount = BigInt(0);
  let lastErr: unknown;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const row = await readBalancesOnce(
        connection,
        owner,
        mint,
        legacyAta,
        lotteryBuySupported,
      );
      total = row.total;
      ataAmount = row.ataAmount;
      decimals = row.decimals;
      if (total > BigInt(0) || ataAmount > BigInt(0)) break;
      if (attempt < 2) await sleep(350 * (attempt + 1));
    } catch (e) {
      lastErr = e;
      const msg = e instanceof Error ? e.message : String(e);
      if (isRpcRateLimitError(msg) && attempt < 2) {
        await sleep(500 * (attempt + 1));
        continue;
      }
      throw e;
    }
  }

  if (total === BigInt(0) && ataAmount === BigInt(0) && lastErr) {
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  }

  return {
    amount: ataAmount.toString(),
    totalAmount: total.toString(),
    decimals,
    ata: legacyAta.toBase58(),
    lotteryBuySupported,
  };
}
