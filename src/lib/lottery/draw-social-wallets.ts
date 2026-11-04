import { PublicKey } from "@solana/web3.js";

import { fetchDrawById } from "./chain";
import { lotteryProgramId } from "./config";
import { withLotteryServerRpc } from "./server-rpc";
import { fetchDrawEntrants } from "./ticket-holders";

const SYSTEM_DEFAULT = PublicKey.default.toBase58();

/**
 * Wallets allowed for public social lookup for a draw: ticket holders plus
 * the on-chain winner (when settled). Used to stop bulk wallet→identity
 * harvesting of arbitrary addresses via /api/profile/social.
 */
export async function walletsAllowedForDrawSocial(
  drawId: number,
): Promise<Set<string>> {
  return withLotteryServerRpc(async (connection) => {
    const programId = lotteryProgramId();
    const draw = await fetchDrawById(connection, programId, drawId);
    const allowed = new Set<string>();
    if (!draw) return allowed;

    if (draw.winner && draw.winner !== SYSTEM_DEFAULT) {
      allowed.add(draw.winner);
    }

    if (draw.totalTickets > 0) {
      const entrants = await fetchDrawEntrants(connection, programId, draw);
      for (const e of entrants) {
        if (e.wallet && e.wallet !== SYSTEM_DEFAULT) {
          allowed.add(e.wallet);
        }
      }
    }

    return allowed;
  });
}
