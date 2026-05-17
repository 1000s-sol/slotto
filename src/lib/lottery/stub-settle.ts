import { createHash } from "node:crypto";

import { PublicKey } from "@solana/web3.js";

import { TICKETS_PER_CHUNK } from "./constants";

/** Matches on-chain `stub_settle_winning_ticket_id` (devnet only). */
export function stubWinningTicketId(
  drawKey: PublicKey,
  slot: bigint,
  unixTs: bigint,
  totalTickets: number,
): number {
  if (totalTickets < 1) {
    throw new Error("Draw has no tickets");
  }
  const h = createHash("sha256");
  h.update(Buffer.from("slotto::settle_stub_v1"));
  h.update(drawKey.toBuffer());
  const slotBuf = Buffer.alloc(8);
  slotBuf.writeBigUInt64LE(slot);
  h.update(slotBuf);
  const tsBuf = Buffer.alloc(8);
  tsBuf.writeBigInt64LE(unixTs);
  h.update(tsBuf);
  const digest = h.digest();
  const roll = digest.readBigUInt64LE(0);
  return Number(roll % BigInt(totalTickets));
}

export function ticketChunkIndex(ticketId: number): number {
  return Math.floor(ticketId / TICKETS_PER_CHUNK);
}

export function ticketSlotInChunk(ticketId: number): number {
  const chunkStart = ticketChunkIndex(ticketId) * TICKETS_PER_CHUNK;
  return ticketId - chunkStart;
}
