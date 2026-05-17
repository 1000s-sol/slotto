import {
  Connection,
  PublicKey,
  SYSVAR_CLOCK_PUBKEY,
} from "@solana/web3.js";

import { DrawState } from "./constants";
import {
  drawPda,
  globalConfigPda,
  prizeVaultPda,
} from "./pdas";
import { createLotteryReadOnlyProgram } from "./program";

export type SplMintRowView = {
  mint: string;
  cap: number;
  sold: number;
  pricePerTicket: string;
  decimals: number;
};

export type LotteryDrawView = {
  drawId: number;
  draw: PublicKey;
  prizeVault: PublicKey;
  salesOpenTs: number;
  salesCloseTs: number;
  state: number;
  totalTickets: number;
  splMints: SplMintRowView[];
};

export async function chainUnixTs(connection: Connection): Promise<number> {
  const info = await connection.getAccountInfo(SYSVAR_CLOCK_PUBKEY, "confirmed");
  if (!info || info.data.length < 40) {
    throw new Error("Could not read Clock sysvar");
  }
  return Number(info.data.readBigInt64LE(32));
}

export async function fetchJackpotLamports(
  connection: Connection,
  prizeVault: PublicKey,
): Promise<number> {
  return connection.getBalance(prizeVault, "confirmed");
}

/** Latest draw in `Selling` state, else the most recently created draw for status display. */
export async function fetchLotteryDraw(
  connection: Connection,
  programId: PublicKey,
): Promise<LotteryDrawView | null> {
  const program = createLotteryReadOnlyProgram(connection);
  const globalConfig = globalConfigPda(programId);

  let cfg;
  try {
    cfg = await program.account.globalConfig.fetch(globalConfig);
  } catch {
    return null;
  }

  const nextId = Number(cfg.nextDrawId);
  if (nextId === 0) return null;

  let fallback: LotteryDrawView | null = null;

  for (let drawId = nextId - 1; drawId >= 0; drawId -= 1) {
    const drawKey = drawPda(programId, drawId);
    try {
      const acct = await program.account.draw.fetch(drawKey);
      const view = toDrawView(programId, drawId, drawKey, acct);
      if (acct.state === DrawState.Selling) return view;
      if (!fallback) fallback = view;
    } catch {
      continue;
    }
  }

  return fallback;
}

function toDrawView(
  programId: PublicKey,
  drawId: number,
  drawKey: PublicKey,
  acct: Awaited<
    ReturnType<
      ReturnType<typeof createLotteryReadOnlyProgram>["account"]["draw"]["fetch"]
    >
  >,
): LotteryDrawView {
  const emptyMint = PublicKey.default.toBase58();
  const splMints: SplMintRowView[] = [];
  for (let i = 0; i < acct.splCount; i += 1) {
    const row = acct.splMintRows[i];
    if (!row) continue;
    const mint = row.mint.toBase58();
    if (mint === emptyMint) continue;
    splMints.push({
      mint,
      cap: row.cap,
      sold: row.sold,
      pricePerTicket: row.pricePerTicket.toString(),
      decimals: row.mintDecimals,
    });
  }

  return {
    drawId,
    draw: drawKey,
    prizeVault: prizeVaultPda(programId, drawKey),
    salesOpenTs: Number(acct.salesOpenTs),
    salesCloseTs: Number(acct.salesCloseTs),
    state: acct.state,
    totalTickets: acct.totalTickets,
    splMints,
  };
}

export function isDrawBuyable(
  draw: LotteryDrawView,
  nowSec: number,
): boolean {
  return (
    draw.state === DrawState.Selling &&
    nowSec >= draw.salesOpenTs &&
    nowSec < draw.salesCloseTs
  );
}
