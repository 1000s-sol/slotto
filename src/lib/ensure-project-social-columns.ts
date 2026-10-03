import { prisma } from "@/lib/prisma";

let ready: Promise<void> | null = null;

/**
 * Idempotent — adds cached social-count columns if Neon has not been db-pushed yet.
 * Only touches "Project" with ADD COLUMN IF NOT EXISTS (nullable).
 */
export function ensureProjectSocialColumns(): Promise<void> {
  if (!ready) {
    ready = prisma
      .$executeRawUnsafe(`
        ALTER TABLE "Project"
          ADD COLUMN IF NOT EXISTS "discordMembers" INTEGER,
          ADD COLUMN IF NOT EXISTS "twitterFollowers" INTEGER,
          ADD COLUMN IF NOT EXISTS "socialCountsAt" TIMESTAMP(3)
      `)
      .then(() => undefined)
      .catch((e) => {
        ready = null;
        console.warn("[project-social] ensure columns failed:", e);
        throw e;
      });
  }
  return ready;
}
