import { createScriptPrismaClient } from "./script-prisma";

const prisma = createScriptPrismaClient();

async function main() {
  const address = process.argv[2]?.trim();
  const label = process.argv[3]?.trim() || undefined;

  if (!address) {
    console.error("Usage: npm run db:add-admin -- <solana-pubkey> [label]");
    process.exit(1);
  }

  if (!process.env.DATABASE_URL?.trim() && !process.env.DIRECT_URL?.trim()) {
    console.error(
      "DATABASE_URL is not set. For local scripts, also set DIRECT_URL (Neon → Connection → Direct).",
    );
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
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Can't reach database server")) {
      console.error(msg);
      console.error(
        "\nNeon may be asleep or the pooler URL may be unreachable from your network.",
      );
      console.error(
        "1. Open the Neon dashboard and wake the project if it is suspended.",
      );
      console.error(
        "2. Copy the Direct connection string into .env as DIRECT_URL (not the pooler URL).",
      );
      console.error("3. Re-run: npm run db:add-admin -- <pubkey>");
      console.error(
        "\nOr run this in Neon → SQL Editor:\n",
        `INSERT INTO "AdminWallet" (id, address, "isActive", "createdAt")
VALUES ('admin-${Date.now()}', '<PUBKEY>', true, NOW())
ON CONFLICT (address) DO UPDATE SET "isActive" = true;`,
      );
      process.exit(1);
    }
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
