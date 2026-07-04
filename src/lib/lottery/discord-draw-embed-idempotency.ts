import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type DiscordDrawEmbedKind = "live" | "ended";

function claimKey(drawId: number, kind: DiscordDrawEmbedKind): string {
  return `draw-${kind}:${drawId}`;
}

/** One Discord draw embed per draw+kind (reuses ticket-sale idempotency table). */
export async function claimDiscordDrawEmbed(
  drawId: number,
  kind: DiscordDrawEmbedKind,
): Promise<boolean> {
  try {
    await prisma.discordTicketSaleNotify.create({
      data: { signature: claimKey(drawId, kind), drawId },
    });
    return true;
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return false;
    }
    throw e;
  }
}

export async function releaseDiscordDrawEmbedClaim(
  drawId: number,
  kind: DiscordDrawEmbedKind,
): Promise<void> {
  await prisma.discordTicketSaleNotify
    .delete({ where: { signature: claimKey(drawId, kind) } })
    .catch(() => {});
}
