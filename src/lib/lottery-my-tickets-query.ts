import { LotteryDrawStatus, Prisma } from "@prisma/client";

import type { MyTicketRow } from "@/lib/lottery-my-tickets-types";
import { prisma } from "@/lib/prisma";

function monthYear(d: Date): string {
  return d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

function paidMintsFromPurchases(rows: { paidWithMints: Prisma.JsonValue | null }[]): string[] {
  const set = new Set<string>();
  for (const r of rows) {
    const raw = r.paidWithMints;
    if (!Array.isArray(raw)) continue;
    for (const x of raw) {
      if (typeof x === "string" && x.trim()) set.add(x.trim());
    }
  }
  return [...set];
}

function formatPct(n: number) {
  if (n >= 10) return `${n.toFixed(1)}%`;
  return `${n.toFixed(2)}%`;
}

async function poolSumByDrawIds(drawIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (drawIds.length === 0) return map;
  const grouped = await prisma.lotteryTicketPurchase.groupBy({
    by: ["drawId"],
    where: { drawId: { in: drawIds } },
    _sum: { tickets: true },
  });
  for (const g of grouped) {
    map.set(g.drawId, g._sum.tickets ?? 0);
  }
  return map;
}

export async function getMyTicketRowsForWallet(wallet: string): Promise<MyTicketRow[]> {
  const rows: MyTicketRow[] = [];

  const activeDraw = await prisma.lotteryDraw.findFirst({
    where: { status: LotteryDrawStatus.ACTIVE },
    orderBy: { drawNumber: "desc" },
    include: {
      purchases: {
        where: { wallet },
        select: { tickets: true, paidWithMints: true },
      },
    },
  });

  const completedDraws = await prisma.lotteryDraw.findMany({
    where: {
      status: LotteryDrawStatus.COMPLETED,
      purchases: { some: { wallet } },
    },
    orderBy: { drawNumber: "desc" },
    include: {
      purchases: {
        where: { wallet },
        select: { tickets: true, paidWithMints: true },
      },
    },
  });

  const drawIds = [
    ...(activeDraw ? [activeDraw.id] : []),
    ...completedDraws.map((d) => d.id),
  ];
  const poolMap = await poolSumByDrawIds(drawIds);

  if (activeDraw) {
    const yourTickets = activeDraw.purchases.reduce((s, p) => s + p.tickets, 0);
    const poolTickets = poolMap.get(activeDraw.id) ?? 0;
    const paidWithMints = paidMintsFromPurchases(activeDraw.purchases);
    const chance = poolTickets > 0 ? (yourTickets / poolTickets) * 100 : 0;
    rows.push({
      drawNumber: activeDraw.drawNumber,
      dateLabel: "Live",
      isLive: true,
      yourTickets,
      poolTickets,
      paidWithMints,
      outcomeLabel: formatPct(chance),
      outcomeVariant: "live",
    });
  }

  for (const d of completedDraws) {
    const yourTickets = d.purchases.reduce((s, p) => s + p.tickets, 0);
    const poolTickets = poolMap.get(d.id) ?? 0;
    const paidWithMints = paidMintsFromPurchases(d.purchases);
    const won = d.winnerWallet != null && d.winnerWallet === wallet;
    const prize = d.prizeSol != null ? Number(d.prizeSol) : null;
    rows.push({
      drawNumber: d.drawNumber,
      dateLabel: d.completedAt ? monthYear(d.completedAt) : monthYear(d.createdAt),
      isLive: false,
      yourTickets,
      poolTickets,
      paidWithMints,
      outcomeLabel: won && prize != null && Number.isFinite(prize) ? `${prize.toFixed(2)} SOL` : "—",
      outcomeVariant: won ? "won" : "lost",
    });
  }

  return rows;
}

export async function hasAnyLotteryDraw(): Promise<boolean> {
  const c = await prisma.lotteryDraw.count();
  return c > 0;
}
