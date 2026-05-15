type SlugNamed = { slug: string; name: string; likes: number };

/**
 * Featured block on /projects: admin DB slug, else FEATURED_PROJECT_SLUG env, else highest likes.
 */
export function pickFeaturedProject<T extends SlugNamed>(
  all: T[],
  adminFeaturedSlug: string | null,
): T | null {
  if (all.length === 0) return null;
  if (adminFeaturedSlug) {
    const hit = all.find((p) => p.slug === adminFeaturedSlug);
    if (hit) return hit;
  }
  const envSlug = process.env.FEATURED_PROJECT_SLUG?.trim();
  if (envSlug) {
    const hit = all.find((p) => p.slug === envSlug);
    if (hit) return hit;
  }
  const byLikes = [...all].sort((a, b) => b.likes - a.likes || a.name.localeCompare(b.name));
  return byLikes[0] ?? null;
}
