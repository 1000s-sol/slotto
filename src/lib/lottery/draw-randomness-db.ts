import { prisma } from "@/lib/prisma";

/** Stored Switchboard randomness account for a draw, if any. */
export async function getStoredDrawRandomness(
  onChainDrawId: number,
): Promise<string | null> {
  try {
    const row = await prisma.lotteryOnChainDrawMeta.findUnique({
      where: { onChainDrawId },
      select: { switchboardRandomness: true },
    });
    const pk = row?.switchboardRandomness?.trim();
    return pk || null;
  } catch (e) {
    console.warn("[lottery randomness] read failed:", e);
    return null;
  }
}

/**
 * Persist the randomness pubkey after the first RandomnessInit so later cranks
 * reuse it. Does not change kind / displayNumber.
 */
export async function storeDrawRandomness(
  onChainDrawId: number,
  randomness: string,
): Promise<void> {
  try {
    const existing = await prisma.lotteryOnChainDrawMeta.findUnique({
      where: { onChainDrawId },
    });
    if (existing) {
      await prisma.lotteryOnChainDrawMeta.update({
        where: { onChainDrawId },
        data: { switchboardRandomness: randomness },
      });
      return;
    }
    await prisma.lotteryOnChainDrawMeta.create({
      data: {
        onChainDrawId,
        kind: "TEST",
        switchboardRandomness: randomness,
      },
    });
  } catch (e) {
    console.warn("[lottery randomness] store failed:", e);
  }
}
