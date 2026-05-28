import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** Upserted on every `prisma db seed` in addition to env vars. */
const SEED_ADMIN_WALLETS = [
  "F2qMgvRwPTNRAmkdqbT5BS6i7U6yWmd1nGEFyppfch3g",
] as const;

function parseAdminWalletList(): string[] {
  const raw = [
    process.env.INITIAL_ADMIN_WALLET,
    process.env.ADDITIONAL_ADMIN_WALLETS,
    ...SEED_ADMIN_WALLETS,
  ]
    .filter(Boolean)
    .join(",");
  return [...new Set(raw.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean))];
}

async function main() {
  const addresses = parseAdminWalletList();
  if (addresses.length === 0) {
    console.info(
      "Skipping admin seed: set INITIAL_ADMIN_WALLET (and optional ADDITIONAL_ADMIN_WALLETS), then run `npx prisma db seed`.",
    );
    return;
  }

  for (const address of addresses) {
    await prisma.adminWallet.upsert({
      where: { address },
      create: {
        address,
        label: address === process.env.INITIAL_ADMIN_WALLET?.trim() ? "Bootstrap" : null,
      },
      update: { isActive: true },
    });
    console.info("Admin wallet allowlisted:", address);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
