import type { OnChainDrawKind } from "@prisma/client";

import { lotteryTestMode } from "@/lib/lottery/test-mode";
import { prisma } from "@/lib/prisma";

export type DrawDisplayMeta = {
  onChainDrawId: number;
  kind: OnChainDrawKind;
  displayNumber: number | null;
};

export function formatDrawDisplayLabel(meta: DrawDisplayMeta): string {
  if (meta.kind === "PRODUCTION" && meta.displayNumber != null) {
    return `#${meta.displayNumber}`;
  }
  return `TEST-${meta.onChainDrawId}`;
}

/** Register metadata when a draw is created in admin. */
export async function registerOnChainDrawMeta(
  onChainDrawId: number,
  opts?: { kind?: OnChainDrawKind },
): Promise<DrawDisplayMeta> {
  const kind = opts?.kind ?? (lotteryTestMode() ? "TEST" : "PRODUCTION");

  let displayNumber: number | null = null;
  if (kind === "PRODUCTION") {
    const agg = await prisma.lotteryOnChainDrawMeta.aggregate({
      where: { kind: "PRODUCTION", displayNumber: { not: null } },
      _max: { displayNumber: true },
    });
    displayNumber = (agg._max.displayNumber ?? 0) + 1;
  }

  const row = await prisma.lotteryOnChainDrawMeta.upsert({
    where: { onChainDrawId },
    create: { onChainDrawId, kind, displayNumber },
    update: { kind, displayNumber },
  });

  return {
    onChainDrawId: row.onChainDrawId,
    kind: row.kind,
    displayNumber: row.displayNumber,
  };
}

export async function getDrawDisplayMeta(
  onChainDrawId: number,
): Promise<DrawDisplayMeta | null> {
  const row = await prisma.lotteryOnChainDrawMeta.findUnique({
    where: { onChainDrawId },
  });
  if (!row) return null;
  return {
    onChainDrawId: row.onChainDrawId,
    kind: row.kind,
    displayNumber: row.displayNumber,
  };
}

export async function getDrawDisplayMetaMap(
  onChainDrawIds: number[],
): Promise<Map<number, DrawDisplayMeta>> {
  if (onChainDrawIds.length === 0) return new Map();
  const rows = await prisma.lotteryOnChainDrawMeta.findMany({
    where: { onChainDrawId: { in: onChainDrawIds } },
  });
  return new Map(
    rows.map((r) => [
      r.onChainDrawId,
      {
        onChainDrawId: r.onChainDrawId,
        kind: r.kind,
        displayNumber: r.displayNumber,
      },
    ]),
  );
}

/** On-chain ids for public draws (#1, #2, …), newest display number first. */
export async function listProductionOnChainDrawIds(): Promise<number[]> {
  const rows = await prisma.lotteryOnChainDrawMeta.findMany({
    where: { kind: "PRODUCTION" },
    select: { onChainDrawId: true },
    orderBy: { displayNumber: "desc" },
  });
  return rows.map((r) => r.onChainDrawId);
}

export async function formatDrawLabelForId(onChainDrawId: number): Promise<string> {
  const meta = await getDrawDisplayMeta(onChainDrawId);
  if (!meta) return `TEST-${onChainDrawId}`;
  return formatDrawDisplayLabel(meta);
}

/** Past winners / winner hero: production draws with a winner only. */
export async function isProductionDrawVisible(
  onChainDrawId: number,
): Promise<boolean> {
  const meta = await getDrawDisplayMeta(onChainDrawId);
  return meta?.kind === "PRODUCTION";
}

/** One-time backfill: draw 9 → #1, other mainnet dry-runs → TEST. */
export async function seedDefaultDrawDisplayMeta(): Promise<void> {
  const productionId = 9;
  const testIds = [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 11];

  await prisma.lotteryOnChainDrawMeta.upsert({
    where: { onChainDrawId: productionId },
    create: {
      onChainDrawId: productionId,
      kind: "PRODUCTION",
      displayNumber: 1,
    },
    update: { kind: "PRODUCTION", displayNumber: 1 },
  });

  for (const id of testIds) {
    await prisma.lotteryOnChainDrawMeta.upsert({
      where: { onChainDrawId: id },
      create: { onChainDrawId: id, kind: "TEST", displayNumber: null },
      update: { kind: "TEST", displayNumber: null },
    });
  }
}
