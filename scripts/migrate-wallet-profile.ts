/**
 * One-time: WalletProfile → UserProfile + LinkedWallet (before or after db:push).
 * Creates new tables if missing, copies legacy data, then you run db:push to finalize.
 *
 * Usage:
 *   npm run db:migrate-profiles
 *   npm run db:push
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function cuidLike(): string {
  return `c${randomUUID().replace(/-/g, "").slice(0, 24)}`;
}

async function tableExists(name: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ${name}
    ) AS "exists"
  `;
  return !!rows[0]?.exists;
}

async function columnExists(table: string, column: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ${table}
        AND column_name = ${column}
    ) AS "exists"
  `;
  return !!rows[0]?.exists;
}

async function ensureNewTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "UserProfile" (
      "id" TEXT NOT NULL,
      "discordId" TEXT,
      "discordUsername" TEXT,
      "discordDisplayName" TEXT,
      "discordAvatarUrl" TEXT,
      "discordAvatarHash" TEXT,
      "xId" TEXT,
      "xHandle" TEXT,
      "xAvatarUrl" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
    );
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "LinkedWallet" (
      "id" TEXT NOT NULL,
      "userProfileId" TEXT NOT NULL,
      "wallet" TEXT NOT NULL,
      "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "LinkedWallet_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "LinkedWallet_userProfileId_fkey"
        FOREIGN KEY ("userProfileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE
    );
  `);
  console.log("UserProfile + LinkedWallet tables ready (indexes added by db:push).");
}

type LegacyRow = {
  wallet: string;
  discordId: string | null;
  discordUsername: string | null;
  discordDisplayName: string | null;
  discordAvatarUrl: string | null;
  discordAvatarHash: string | null;
  xId: string | null;
  xHandle: string | null;
  xAvatarUrl: string | null;
};

async function migrateWalletProfiles() {
  if (!(await tableExists("WalletProfile"))) {
    console.log("No WalletProfile table — skip legacy wallet rows.");
    return;
  }

  const legacy = await prisma.$queryRaw<LegacyRow[]>`
    SELECT wallet, "discordId", "discordUsername", "discordDisplayName",
           "discordAvatarUrl", "discordAvatarHash", "xId", "xHandle", "xAvatarUrl"
    FROM "WalletProfile"
  `;

  if (legacy.length === 0) {
    console.log("WalletProfile empty — nothing to copy.");
    return;
  }

  console.log(`Migrating ${legacy.length} WalletProfile row(s)…`);
  const byDiscord = new Map<string, string>();
  const byX = new Map<string, string>();

  for (const row of legacy) {
    let profileId: string | null = null;
    if (row.discordId && byDiscord.has(row.discordId)) {
      profileId = byDiscord.get(row.discordId)!;
    } else if (row.xId && byX.has(row.xId)) {
      profileId = byX.get(row.xId)!;
    } else {
      const existing = row.discordId
        ? await prisma.userProfile.findUnique({ where: { discordId: row.discordId } })
        : row.xId
          ? await prisma.userProfile.findUnique({ where: { xId: row.xId } })
          : null;
      profileId = existing?.id ?? cuidLike();
      if (!existing) {
        await prisma.$executeRaw`
          INSERT INTO "UserProfile" (
            "id", "discordId", "discordUsername", "discordDisplayName",
            "discordAvatarUrl", "discordAvatarHash", "xId", "xHandle", "xAvatarUrl",
            "createdAt", "updatedAt"
          ) VALUES (
            ${profileId}, ${row.discordId}, ${row.discordUsername}, ${row.discordDisplayName},
            ${row.discordAvatarUrl}, ${row.discordAvatarHash}, ${row.xId}, ${row.xHandle}, ${row.xAvatarUrl},
            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
          ON CONFLICT ("id") DO NOTHING
        `;
      }
      if (row.discordId) byDiscord.set(row.discordId, profileId);
      if (row.xId) byX.set(row.xId, profileId);
    }

    const linkId = cuidLike();
    await prisma.$executeRaw`
      INSERT INTO "LinkedWallet" ("id", "userProfileId", "wallet", "verifiedAt", "createdAt")
      VALUES (${linkId}, ${profileId}, ${row.wallet}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT ("wallet") DO UPDATE SET "userProfileId" = ${profileId}
    `;
    console.log(`  ${row.wallet.slice(0, 4)}… → profile ${profileId.slice(0, 8)}…`);
  }
}

async function migrateProjectLikes() {
  if (!(await tableExists("ProjectLike"))) return;

  const hasWallet = await columnExists("ProjectLike", "wallet");
  const hasProfileId = await columnExists("ProjectLike", "userProfileId");

  if (!hasWallet) {
    console.log("ProjectLike already uses userProfileId only — skip likes migration.");
    return;
  }

  if (!hasProfileId) {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "ProjectLike" ADD COLUMN IF NOT EXISTS "userProfileId" TEXT;
    `);
    console.log("Added ProjectLike.userProfileId column.");
  }

  const likes = await prisma.$queryRaw<
    Array<{ id: string; projectId: string; wallet: string }>
  >`
    SELECT id, "projectId", wallet FROM "ProjectLike" WHERE wallet IS NOT NULL
  `;

  for (const like of likes) {
    let link = await prisma.linkedWallet.findUnique({ where: { wallet: like.wallet } });
    if (!link) {
      const profileId = cuidLike();
      await prisma.userProfile.create({ data: { id: profileId } });
      link = await prisma.linkedWallet.create({
        data: { wallet: like.wallet, userProfileId: profileId },
      });
    }
    await prisma.$executeRaw`
      UPDATE "ProjectLike" SET "userProfileId" = ${link.userProfileId} WHERE id = ${like.id}
    `;
  }
  console.log(`Migrated ${likes.length} project like(s).`);
}

async function main() {
  await ensureNewTables();
  await migrateWalletProfiles();
  await migrateProjectLikes();
  console.log("\nNext: npm run db:push");
  console.log("(syncs schema, drops WalletProfile, removes ProjectLike.wallet if present)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
