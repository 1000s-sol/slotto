/**
 * One-time: WalletProfile (wallet PK) → UserProfile + LinkedWallet.
 * ProjectLike.wallet → userProfileId (via linked wallet / migrated profile).
 *
 * Usage: npm run db:migrate-profiles
 */
import "dotenv/config";

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const legacy = await prisma.$queryRaw<
    Array<{
      wallet: string;
      discordId: string | null;
      discordUsername: string | null;
      discordDisplayName: string | null;
      discordAvatarUrl: string | null;
      discordAvatarHash: string | null;
      xId: string | null;
      xHandle: string | null;
      xAvatarUrl: string | null;
    }>
  >`
    SELECT wallet, "discordId", "discordUsername", "discordDisplayName",
           "discordAvatarUrl", "discordAvatarHash", "xId", "xHandle", "xAvatarUrl"
    FROM "WalletProfile"
  `.catch(() => []);

  if (legacy.length === 0) {
    console.log("No WalletProfile table or empty — skipping legacy migration.");
  } else {
    console.log(`Migrating ${legacy.length} WalletProfile rows…`);
    for (const row of legacy) {
      let profile = row.discordId
        ? await prisma.userProfile.findUnique({
            where: { discordId: row.discordId },
          })
        : row.xId
          ? await prisma.userProfile.findUnique({ where: { xId: row.xId } })
          : null;

      if (!profile) {
        profile = await prisma.userProfile.create({
          data: {
            discordId: row.discordId,
            discordUsername: row.discordUsername,
            discordDisplayName: row.discordDisplayName,
            discordAvatarUrl: row.discordAvatarUrl,
            discordAvatarHash: row.discordAvatarHash,
            xId: row.xId,
            xHandle: row.xHandle,
            xAvatarUrl: row.xAvatarUrl,
          },
        });
      }

      await prisma.linkedWallet.upsert({
        where: { wallet: row.wallet },
        create: { wallet: row.wallet, userProfileId: profile.id },
        update: { userProfileId: profile.id },
      });
    }
  }

  const likes = await prisma.$queryRaw<
    Array<{ id: string; projectId: string; wallet: string }>
  >`
    SELECT id, "projectId", wallet FROM "ProjectLike" WHERE wallet IS NOT NULL
  `.catch(() => []);

  for (const like of likes) {
    const link = await prisma.linkedWallet.findUnique({
      where: { wallet: like.wallet },
    });
    if (!link) {
      const profile = await prisma.userProfile.create({ data: {} });
      await prisma.linkedWallet.create({
        data: { wallet: like.wallet, userProfileId: profile.id },
      });
      await prisma.projectLike.update({
        where: { id: like.id },
        data: { userProfileId: profile.id },
      });
      continue;
    }
    await prisma.projectLike.update({
      where: { id: like.id },
      data: { userProfileId: link.userProfileId },
    });
  }

  console.log("Done. Run: npx prisma db push (drops WalletProfile if removed from schema)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
