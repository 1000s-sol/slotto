import { PublicKey } from "@solana/web3.js";

/** Read settlement fields; `winningTicketId` is taken from 4 bytes before `winner` in account data. */
export function readDrawSettlementFields(
  data: Buffer,
  expectedWinner?: PublicKey | null,
): {
  winningTicketId: number;
  winner: PublicKey | null;
} {
  const empty = PublicKey.default;
  let winnerOff = -1;

  if (expectedWinner && !expectedWinner.equals(empty)) {
    const w = expectedWinner.toBuffer();
    for (let off = 8; off <= data.length - 32; off += 1) {
      if (data.subarray(off, off + 32).equals(w)) winnerOff = off;
    }
  } else {
    for (let off = data.length - 40; off >= 8; off -= 1) {
      const pk = new PublicKey(data.subarray(off, off + 32));
      if (!pk.equals(empty)) {
        winnerOff = off;
        break;
      }
    }
  }

  if (winnerOff < 4) {
    return { winningTicketId: 0, winner: null };
  }

  const winningTicketId = data.readUInt32LE(winnerOff - 4);
  const winner = new PublicKey(data.subarray(winnerOff, winnerOff + 32));
  return {
    winningTicketId,
    winner: winner.equals(empty) ? null : winner,
  };
}
