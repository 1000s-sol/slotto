import { prisma } from "@/lib/prisma";

let ready: Promise<void> | null = null;

/**
 * Idempotent — adds listing-section columns if Neon has not been db-pushed yet.
 * Only touches "Project" with ADD COLUMN IF NOT EXISTS (nullable TEXT).
 * Safe alongside a live lottery draw (no draw/ticket tables).
 */
export function ensureProjectSectionColumns(): Promise<void> {
  if (!ready) {
    ready = prisma
      .$executeRawUnsafe(`
        ALTER TABLE "Project"
          ADD COLUMN IF NOT EXISTS "sectionOverview" TEXT,
          ADD COLUMN IF NOT EXISTS "sectionStaking" TEXT,
          ADD COLUMN IF NOT EXISTS "sectionToken" TEXT,
          ADD COLUMN IF NOT EXISTS "sectionHolderUtility" TEXT,
          ADD COLUMN IF NOT EXISTS "sectionServices" TEXT
      `)
      .then(() => undefined)
      .catch((e) => {
        ready = null;
        console.warn("[project-sections] ensure columns failed:", e);
        throw e;
      });
  }
  return ready;
}
