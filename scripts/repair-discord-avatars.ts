/**
 * Fix UserProfile rows that stored embed/avatars/*.png instead of a real pfp.
 * Requires DISCORD_BOT_TOKEN (same Discord app → Bot → token).
 *
 * Usage: npm run db:repair-discord-avatars
 */
import "dotenv/config";

import { discordBotToken } from "../src/lib/discord-api";
import { prisma } from "../src/lib/prisma";
import { ensureDiscordProfileComplete } from "../src/lib/user-profile-db";

async function main() {
  if (!discordBotToken()) {
    console.error(
      "DISCORD_BOT_TOKEN is not set. Create a bot in your Discord app and add the token to .env",
    );
    process.exit(1);
  }

  const rows = await prisma.userProfile.findMany({
    where: { discordId: { not: null } },
  });

  for (const row of rows) {
    const fixed = await ensureDiscordProfileComplete(row);
    console.log(
      fixed.id,
      "→",
      fixed.discordAvatarUrl ?? "(no custom avatar on Discord)",
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
