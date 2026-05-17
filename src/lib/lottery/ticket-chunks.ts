import { TICKETS_PER_CHUNK } from "./constants";

/** Same logic as on-chain `ticket_chunk_indices_for_range`. */
export function ticketChunkIndicesForRange(base: number, count: number): number[] {
  if (count === 0) return [];
  const end = base + count;
  const out: number[] = [];
  let ticketId = base;
  while (ticketId < end) {
    const c = Math.floor(ticketId / TICKETS_PER_CHUNK);
    if (out[out.length - 1] !== c) out.push(c);
    ticketId += 1;
  }
  return out;
}
