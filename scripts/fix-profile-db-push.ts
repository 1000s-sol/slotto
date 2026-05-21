/**
 * After a failed/interrupted db:push, drop indexes the migrate script created
 * so `npm run db:push` can finish cleanly.
 *
 * Usage: npm run db:fix-profile-push && npm run db:push
 */
import "dotenv/config";

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const INDEXES = [
  "UserProfile_discordId_key",
  "UserProfile_xId_key",
  "LinkedWallet_wallet_key",
  "LinkedWallet_userProfileId_idx",
];

async function main() {
  for (const name of INDEXES) {
    await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS "${name}"`);
    console.log(`Dropped index ${name} (if it existed).`);
  }
  console.log("\nNow run: npm run db:push");
  console.log("(Set DIRECT_URL in .env — use Neon direct host, not -pooler)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
