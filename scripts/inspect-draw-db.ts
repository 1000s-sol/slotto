import "dotenv/config";

import { prisma } from "../src/lib/prisma";

async function main() {
  const drawId = parseInt(process.argv[2] ?? "6", 10);

  const rows = await prisma.lotteryDrawSplMint.findMany({
    where: { onChainDrawId: drawId },
    orderBy: { mint: "asc" },
  });
  console.log("DB lotteryDrawSplMint rows for draw #" + drawId + " (" + rows.length + "):");
  for (const r of rows) {
    console.log(
      `  - ${r.mint}  sym=${r.symbol ?? ""} cap=${r.onChainCap} disp=${r.displayCap} pub=${r.published} locked=${r.purchasesLocked} dec=${r.mintDecimals}`,
    );
  }

  const allRows = await prisma.lotteryDrawSplMint.groupBy({
    by: ["onChainDrawId"],
    _count: { _all: true },
  });
  console.log("\nAll draw ids with SPL rows:");
  for (const g of allRows.sort((a, b) => a.onChainDrawId - b.onChainDrawId)) {
    console.log(`  draw #${g.onChainDrawId}: ${g._count._all} rows`);
  }

  const projects = await prisma.project.findMany({
    where: { published: true, NOT: { tokenMint: null } },
    select: { slug: true, name: true, tokenMint: true, tokenLiquid: true },
    orderBy: { name: "asc" },
  });
  console.log("\nPublished projects with tokenMint (" + projects.length + "):");
  for (const p of projects) {
    console.log(`  - ${p.name} [${p.slug}] mint=${p.tokenMint} liquid=${p.tokenLiquid}`);
  }

  console.log("\nFREE_ENTRY_MINT env:", process.env.NEXT_PUBLIC_FREE_ENTRY_MINT ?? "(unset)");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
