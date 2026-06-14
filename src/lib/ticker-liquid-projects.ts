import { prisma } from "@/lib/prisma";

export type LiquidTickerProject = {
  mint: string;
  slug: string;
  name: string;
};

/** Published projects with a liquid (tradeable) token mint for the price ticker. */
export async function fetchLiquidTickerProjects(): Promise<LiquidTickerProject[]> {
  const rows = await prisma.project.findMany({
    where: {
      published: true,
      tokenLiquid: true,
      NOT: { tokenMint: null },
    },
    select: { tokenMint: true, slug: true, name: true },
    orderBy: { name: "asc" },
  });

  const out: LiquidTickerProject[] = [];
  for (const r of rows) {
    const mint = r.tokenMint?.trim();
    if (!mint) continue;
    out.push({ mint, slug: r.slug, name: r.name });
  }
  return out;
}
