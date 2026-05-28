/** Matches on-chain `winning_ticket_from_vrf_bytes` in `programs/slotto_lottery`. */
export function winningTicketFromVrfBytes(
  bytes: Uint8Array | Buffer,
  totalTickets: number,
): number {
  if (totalTickets < 1) throw new Error("totalTickets must be >= 1");
  const view = bytes instanceof Buffer ? bytes : Buffer.from(bytes);
  if (view.length < 8) throw new Error("VRF bytes too short");
  const roll = view.readBigUInt64LE(0);
  return Number(roll % BigInt(totalTickets));
}
