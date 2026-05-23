import {
  Connection,
  PublicKey,
  SYSVAR_CLOCK_PUBKEY,
} from "@solana/web3.js";

import { DrawState } from "./constants";
import {
  readDrawFromRaw,
  readSplMintRowFromRaw,
} from "./draw-account";
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
  winningTicketId: number;
  winner: string | null;
};

export async function chainUnixTs(connection: Connection): Promise<number> {
  const info = await connection.getAccountInfo(SYSVAR_CLOCK_PUBKEY, "confirmed");
  if (!info || info.data.length < 40) {
    throw new Error("Could not read Clock sysvar");
  }
  return Number(info.data.readBigInt64LE(32));
}

/** Prize vault balance minus rent-exempt minimum (matches on-chain withdrawable pot). */
export async function fetchJackpotLamports(
  connection: Connection,
  prizeVault: PublicKey,
): Promise<number> {
  const info = await connection.getAccountInfo(prizeVault, "confirmed");
  if (!info) return 0;
  const rentMin = await connection.getMinimumBalanceForRentExemption(
    info.data.length,
  );
  return Math.max(0, info.lamports - rentMin);
}

function toDrawViewFromRaw(
  programId: PublicKey,
  drawId: number,
  drawKey: PublicKey,
  data: Buffer,
): LotteryDrawView | null {
  const raw = readDrawFromRaw(data);
  if (!raw) return null;

  const emptyMint = PublicKey.default.toBase58();
  const splMints: SplMintRowView[] = [];
  for (let i = 0; i < raw.splCount; i += 1) {
    const row = readSplMintRowFromRaw(data, i);
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
    salesOpenTs: raw.salesOpenTs,
    salesCloseTs: raw.salesCloseTs,
    state: raw.state,
    totalTickets: raw.totalTickets,
    splMints,
    winningTicketId: raw.winningTicketId,
    winner: raw.winner?.toBase58() ?? null,
  };
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
    const draw = await fetchDrawById(connection, programId, drawId);
    if (!draw) continue;
    if (draw.state === DrawState.Selling) return draw;
    if (!fallback) fallback = draw;
  }

  return fallback;
}

export async function fetchDrawById(
  connection: Connection,
  programId: PublicKey,
  drawId: number,
): Promise<LotteryDrawView | null> {
  const drawKey = drawPda(programId, drawId);
  const info = await connection.getAccountInfo(drawKey, "confirmed");
  if (!info?.data?.length) return null;
  return toDrawViewFromRaw(programId, drawId, drawKey, Buffer.from(info.data));
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
