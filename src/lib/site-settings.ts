import { prisma } from "@/lib/prisma";

export const SITE_SETTINGS_ROW_ID = "default" as const;

/** Admin-picked featured project slug, or null when set to automatic. */
export async function getFeaturedProjectSlugFromDb(): Promise<string | null> {
  const row = await prisma.siteSettings.findUnique({
    where: { id: SITE_SETTINGS_ROW_ID },
    select: { featuredProjectSlug: true },
  });
  const s = row?.featuredProjectSlug?.trim();
  return s || null;
}
