import { PublicKey } from "@solana/web3.js";

import { VRF_STUB_MARKER } from "./constants";

/** Matches on-chain `SplMintRow` size (`#[repr(C)]` + 4-byte tail padding). */
export const DRAW_SPL_MINT_ROW_BYTES = 56;
/** Matches program `SPL_MINT_MAX`. */
export const DRAW_SPL_MINT_MAX = 50;
/** Start of `spl_mint_rows` in the draw account body (after 8-byte discriminator). */
export const DRAW_SPL_ROWS_OFFSET = 80;
export const DRAW_VRF_OFFSET =
  DRAW_SPL_ROWS_OFFSET + DRAW_SPL_MINT_MAX * DRAW_SPL_MINT_ROW_BYTES;
export const DRAW_WINNING_TICKET_ID_OFFSET = DRAW_VRF_OFFSET + 32;
export const DRAW_WINNER_OFFSET = DRAW_WINNING_TICKET_ID_OFFSET + 4;
export const DRAW_SPL_AUTH_BUMP_OFFSET = DRAW_WINNER_OFFSET + 32;

export type RawDrawFields = {
  drawId: number;
  salesOpenTs: number;
  salesCloseTs: number;
  state: number;
  totalTickets: number;
  splCount: number;
  vrfRequest: PublicKey;
  winningTicketId: number;
  winner: PublicKey | null;
};

/** Parse zero-copy [`Draw`] account bytes (see `programs/slotto_lottery/src/lib.rs`). */
export function readDrawFromRaw(data: Buffer): RawDrawFields | null {
  const minLen = 8 + DRAW_SPL_AUTH_BUMP_OFFSET + 1;
  if (data.length < minLen) return null;

  const base = 8;
  const empty = PublicKey.default;
  const winnerPk = new PublicKey(
    data.subarray(base + DRAW_WINNER_OFFSET, base + DRAW_WINNER_OFFSET + 32),
  );
  const vrfRequest = new PublicKey(
    data.subarray(base + DRAW_VRF_OFFSET, base + DRAW_VRF_OFFSET + 32),
  );

  return {
    drawId: Number(data.readBigUInt64LE(base)),
    salesOpenTs: Number(data.readBigInt64LE(base + 16)),
    salesCloseTs: Number(data.readBigInt64LE(base + 24)),
    state: data[base + 32] ?? 0,
    totalTickets: data.readUInt32LE(base + 36),
    splCount: data[base + 72] ?? 0,
    vrfRequest,
    winningTicketId: data.readUInt32LE(base + DRAW_WINNING_TICKET_ID_OFFSET),
    winner: winnerPk.equals(empty) ? null : winnerPk,
  };
}

export type RawSplMintRow = {
  mint: PublicKey;
  pricePerTicket: bigint;
  mintDecimals: number;
  cap: number;
  sold: number;
};

export function isVrfStubMarker(vrfRequest: PublicKey): boolean {
  return vrfRequest.equals(VRF_STUB_MARKER);
}

export function readSplMintRowFromRaw(
  data: Buffer,
  rowIndex: number,
): RawSplMintRow | null {
  const base = 8 + DRAW_SPL_ROWS_OFFSET + rowIndex * DRAW_SPL_MINT_ROW_BYTES;
  if (base + DRAW_SPL_MINT_ROW_BYTES > data.length) return null;
  return {
    mint: new PublicKey(data.subarray(base, base + 32)),
    pricePerTicket: data.readBigUInt64LE(base + 32),
    mintDecimals: data[base + 40] ?? 0,
    cap: data.readUInt32LE(base + 44),
    sold: data.readUInt32LE(base + 48),
  };
}
