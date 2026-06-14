import { prisma } from "@/lib/prisma";
import { WRAPPED_SOL_MINT } from "@/lib/token-usd-prices";

/** Map UI `SOL` / wrapped mint to the mint string stored for payment chips. */
export function payWithToMint(payWith: string): string {
  const raw = payWith.trim();
  if (raw === "SOL" || raw === WRAPPED_SOL_MINT) return WRAPPED_SOL_MINT;
  return raw;
}

function sortMintList(mints: string[]): string[] {
  return [...new Set(mints)].sort((a, b) => {
    if (a === WRAPPED_SOL_MINT) return -1;
    if (b === WRAPPED_SOL_MINT) return 1;
    return a.localeCompare(b);
  });
}

/** Aggregate payment mints per wallet for a draw (on-chain draw id = drawNumber). */
export async function getDrawPaidWithFromDb(
  drawNumber: number,
): Promise<Record<string, string[]>> {
  const draw = await prisma.lotteryDraw.findUnique({
    where: { drawNumber },
    include: {
      purchases: { select: { wallet: true, paidWithMints: true } },
    },
  });
  if (!draw) return {};

  const acc = new Map<string, Set<string>>();
  for (const row of draw.purchases) {
    const raw = row.paidWithMints;
    const mints = Array.isArray(raw)
      ? raw.filter((m): m is string => typeof m === "string")
      : [];
    if (mints.length === 0) continue;
    let set = acc.get(row.wallet);
    if (!set) {
      set = new Set();
      acc.set(row.wallet, set);
    }
    for (const m of mints) set.add(m);
  }

  const out: Record<string, string[]> = {};
  for (const [wallet, set] of acc) {
    out[wallet] = sortMintList([...set]);
  }
  return out;
}

export type RecordTicketPurchaseInput = {
  signature: string;
  wallet: string;
  drawNumber: number;
  count: number;
  payWith: string;
};

/** Idempotent — skips if signature already recorded. Returns true when inserted. */
export async function recordLotteryTicketPurchase(
  input: RecordTicketPurchaseInput,
): Promise<boolean> {
  const signature = input.signature.trim();
  const wallet = input.wallet.trim();
  if (!signature || !wallet) return false;

  const existing = await prisma.lotteryTicketPurchase.findUnique({
    where: { signature },
    select: { id: true },
  });
  if (existing) return false;

  const mint = payWithToMint(input.payWith);
  const draw = await prisma.lotteryDraw.upsert({
    where: { drawNumber: input.drawNumber },
    create: { drawNumber: input.drawNumber },
    update: {},
  });

  await prisma.$transaction([
    prisma.lotteryTicketPurchase.create({
      data: {
        drawId: draw.id,
        wallet,
        tickets: input.count,
        signature,
        paidWithMints: [mint],
      },
    }),
    prisma.lotteryDraw.update({
      where: { id: draw.id },
      data: { totalTicketsSold: { increment: input.count } },
    }),
  ]);

  return true;
}

/** Bulk upsert from a chain scan (backfill). Merges mints per wallet. */
export async function mergeDrawPaidWithIntoDb(
  drawNumber: number,
  paidWith: Record<string, string[]>,
): Promise<number> {
  if (Object.keys(paidWith).length === 0) return 0;

  const draw = await prisma.lotteryDraw.upsert({
    where: { drawNumber },
    create: { drawNumber },
    update: {},
  });

  let inserted = 0;
  for (const [wallet, mints] of Object.entries(paidWith)) {
    if (mints.length === 0) continue;
    const signature = `backfill:${drawNumber}:${wallet}`;
    const existing = await prisma.lotteryTicketPurchase.findUnique({
      where: { signature },
      select: { id: true, paidWithMints: true },
    });
    const merged = sortMintList([
      ...(existing && Array.isArray(existing.paidWithMints)
        ? (existing.paidWithMints as string[])
        : []),
      ...mints,
    ]);
    if (existing) {
      await prisma.lotteryTicketPurchase.update({
        where: { signature },
        data: { paidWithMints: merged },
      });
    } else {
      await prisma.lotteryTicketPurchase.create({
        data: {
          drawId: draw.id,
          wallet,
          tickets: 0,
          signature,
          paidWithMints: merged,
        },
      });
      inserted += 1;
    }
  }
  return inserted;
}
