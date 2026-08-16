import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type DiscordDrawEmbedKind = "live" | "ended";

/** Claim/lock row. Written before posting. */
function claimKey(drawId: number, kind: DiscordDrawEmbedKind): string {
  return `draw-${kind}:${drawId}`;
}

/** Written only after at least one channel accepted the embed. */
function confirmKey(drawId: number, kind: DiscordDrawEmbedKind): string {
  return `draw-${kind}-ok:${drawId}`;
}

const IN_FLIGHT_MS = 2 * 60 * 1000;
/** Pre-confirm rows older than this are treated as successful (legacy claim-as-confirm). */
const LEGACY_CONFIRM_MS = 2 * 60 * 60 * 1000;

function isUniqueViolation(e: unknown): boolean {
  return (
    e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002"
  );
}

async function findNotify(signature: string) {
  return prisma.discordTicketSaleNotify.findUnique({ where: { signature } });
}

export async function hasConfirmedDiscordDrawEmbed(
  drawId: number,
  kind: DiscordDrawEmbedKind,
): Promise<boolean> {
  const ok = await findNotify(confirmKey(drawId, kind));
  if (ok) return true;
  const lock = await findNotify(claimKey(drawId, kind));
  if (!lock) return false;
  return Date.now() - lock.postedAt.getTime() >= LEGACY_CONFIRM_MS;
}

/** One Discord draw embed per draw+kind (reuses ticket-sale idempotency table). */
export async function claimDiscordDrawEmbed(
  drawId: number,
  kind: DiscordDrawEmbedKind,
): Promise<boolean> {
  if (await findNotify(confirmKey(drawId, kind))) {
    return false;
  }

  const lockSig = claimKey(drawId, kind);
  const existing = await findNotify(lockSig);
  if (existing) {
    const age = Date.now() - existing.postedAt.getTime();
    if (age < IN_FLIGHT_MS) return false;
    if (age >= LEGACY_CONFIRM_MS) return false;
    await prisma.discordTicketSaleNotify
      .delete({ where: { signature: lockSig } })
      .catch(() => {});
  }

  try {
    await prisma.discordTicketSaleNotify.create({
      data: { signature: lockSig, drawId },
    });
    return true;
  } catch (e) {
    if (isUniqueViolation(e)) return false;
    throw e;
  }
}

export async function confirmDiscordDrawEmbed(
  drawId: number,
  kind: DiscordDrawEmbedKind,
): Promise<void> {
  try {
    await prisma.discordTicketSaleNotify.create({
      data: { signature: confirmKey(drawId, kind), drawId },
    });
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;
  }
}

export async function releaseDiscordDrawEmbedClaim(
  drawId: number,
  kind: DiscordDrawEmbedKind,
): Promise<void> {
  await Promise.all([
    prisma.discordTicketSaleNotify
      .delete({ where: { signature: claimKey(drawId, kind) } })
      .catch(() => {}),
    prisma.discordTicketSaleNotify
      .delete({ where: { signature: confirmKey(drawId, kind) } })
      .catch(() => {}),
  ]);
}
