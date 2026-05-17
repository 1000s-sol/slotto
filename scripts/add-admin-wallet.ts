import "dotenv/config";

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const address = process.argv[2]?.trim();
  const label = process.argv[3]?.trim() || undefined;

  if (!address) {
    console.error("Usage: npm run db:add-admin -- <solana-pubkey> [label]");
    process.exit(1);
  }

  if (!process.env.DATABASE_URL?.trim()) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  const row = await prisma.adminWallet.upsert({
    where: { address },
    create: { address, label },
    update: { isActive: true, ...(label ? { label } : {}) },
  });

  console.info("Admin wallet allowlisted:", row.address, row.label ?? "");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
