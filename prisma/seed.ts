import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const addr = process.env.INITIAL_ADMIN_WALLET?.trim();
  if (!addr) {
    console.info(
      "Skipping admin seed: set INITIAL_ADMIN_WALLET to your Solana pubkey, then run `npx prisma db seed`.",
    );
    return;
  }

  await prisma.adminWallet.upsert({
    where: { address: addr },
    create: { address: addr, label: "Bootstrap" },
    update: { isActive: true },
  });

  console.info("Admin wallet allowlisted:", addr);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
