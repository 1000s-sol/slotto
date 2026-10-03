import { ensureProjectSocialColumns } from "@/lib/ensure-project-social-columns";
import { prisma } from "@/lib/prisma";
import { normalizeXHandle } from "@/lib/social-profile-url";

const DEFAULT_REVALIDATE_SEC = 3600;
/** Refresh cached directory counts when older than this. */
const SOCIAL_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const SOCIAL_REFRESH_CONCURRENCY = 10;

/** Compact count for social pills: 6428 → "6.4k", 24176 → "24.2k". */
export function formatSocialCount(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(n) || n < 0) return null;
  const v = Math.floor(n);
  if (v < 1000) return v.toLocaleString("en-US");
  if (v < 10_000) {
    const k = v / 1000;
    const s = k >= 10 ? k.toFixed(0) : k.toFixed(1).replace(/\.0$/, "");
    return `${s}k`;
  }
  if (v < 1_000_000) {
    const k = v / 1000;
    const s = k >= 100 ? k.toFixed(0) : k.toFixed(1).replace(/\.0$/, "");
    return `${s}k`;
  }
  const m = v / 1_000_000;
  const s = m >= 100 ? m.toFixed(0) : m.toFixed(1).replace(/\.0$/, "");
  return `${s}M`;
}

/** Extract Discord invite / vanity code from common invite URL shapes. */
export function parseDiscordInviteCode(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const s = raw.trim();
  try {
    const u = new URL(s.startsWith("http") ? s : `https://${s}`);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    const parts = u.pathname.split("/").filter(Boolean);
    if (host === "discord.gg" && parts[0]) return parts[0];
    if (
      (host === "discord.com" || host === "discordapp.com") &&
      parts[0]?.toLowerCase() === "invite" &&
      parts[1]
    ) {
      return parts[1];
    }
  } catch {
    /* fall through */
  }
  const m = s.match(
    /(?:discord(?:app)?\.(?:gg|com)\/(?:invite\/)?)([A-Za-z0-9-]+)/i,
  );
  return m?.[1] ?? null;
}

type DiscordInviteJson = {
  approximate_member_count?: number;
  code?: string;
  message?: string;
};

/**
 * Live Discord approximate member count from a public invite / vanity URL.
 * Soft-fails to null when the invite is missing, expired, or Discord errors.
 */
export async function fetchDiscordMemberCount(
  discordUrl: string | null | undefined,
  revalidateSec = DEFAULT_REVALIDATE_SEC,
): Promise<number | null> {
  const code = parseDiscordInviteCode(discordUrl);
  if (!code) return null;
  try {
    const res = await fetch(
      `https://discord.com/api/v10/invites/${encodeURIComponent(code)}?with_counts=true`,
      {
        headers: { Accept: "application/json" },
        next: { revalidate: revalidateSec },
      },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as DiscordInviteJson;
    const n = json.approximate_member_count;
    return typeof n === "number" && Number.isFinite(n) && n >= 0
      ? Math.floor(n)
      : null;
  } catch {
    return null;
  }
}

type FxTwitterUserJson = {
  code?: number;
  message?: string;
  user?: {
    followers?: number;
    screen_name?: string;
  };
};

/**
 * Live X follower count for a project twitterUrl / handle.
 * Uses the public FxTwitter user endpoint; soft-fails when the handle is
 * missing, suspended, or the upstream is unavailable.
 */
export async function fetchXFollowerCount(
  twitterUrl: string | null | undefined,
  revalidateSec = DEFAULT_REVALIDATE_SEC,
): Promise<number | null> {
  const handle = twitterUrl ? normalizeXHandle(twitterUrl) : null;
  if (!handle) return null;
  try {
    const res = await fetch(
      `https://api.fxtwitter.com/${encodeURIComponent(handle)}`,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": "SlottoProjectSocialStats/1.0",
        },
        next: { revalidate: revalidateSec },
      },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as FxTwitterUserJson;
    const n = json.user?.followers;
    return typeof n === "number" && Number.isFinite(n) && n >= 0
      ? Math.floor(n)
      : null;
  } catch {
    return null;
  }
}

export type ProjectSocialCounts = {
  discordMembers: number | null;
  twitterFollowers: number | null;
};

/** Parallel Discord + X counts for a project profile. */
export async function fetchProjectSocialCounts(
  discordUrl: string | null | undefined,
  twitterUrl: string | null | undefined,
  revalidateSec = DEFAULT_REVALIDATE_SEC,
): Promise<ProjectSocialCounts> {
  const [discordMembers, twitterFollowers] = await Promise.all([
    fetchDiscordMemberCount(discordUrl, revalidateSec),
    fetchXFollowerCount(twitterUrl, revalidateSec),
  ]);
  return { discordMembers, twitterFollowers };
}

/** Fetch live counts and persist non-null values onto the project row. */
export async function fetchAndStoreProjectSocialCounts(
  projectId: string,
  discordUrl: string | null | undefined,
  twitterUrl: string | null | undefined,
  revalidateSec = DEFAULT_REVALIDATE_SEC,
): Promise<ProjectSocialCounts> {
  const counts = await fetchProjectSocialCounts(discordUrl, twitterUrl, revalidateSec);
  try {
    await ensureProjectSocialColumns();
    await prisma.project.update({
      where: { id: projectId },
      data: {
        ...(counts.discordMembers != null ? { discordMembers: counts.discordMembers } : {}),
        ...(counts.twitterFollowers != null
          ? { twitterFollowers: counts.twitterFollowers }
          : {}),
        socialCountsAt: new Date(),
      },
    });
  } catch (e) {
    console.warn("[project-social] persist failed:", e);
  }
  return counts;
}

type SocialSortProject = {
  id: string;
  discordUrl: string | null;
  twitterUrl: string | null;
  discordMembers: number | null;
  twitterFollowers: number | null;
  socialCountsAt: Date | null;
};

async function mapPool<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  if (items.length === 0) return;
  let i = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx]!);
    }
  });
  await Promise.all(workers);
}

/**
 * Refresh stale/missing Discord or X counts for directory sorting, then return
 * a map of projectId → latest count for the requested field.
 */
export async function refreshSocialCountsForSort(
  projects: SocialSortProject[],
  field: "discord" | "twitter",
): Promise<Map<string, number | null>> {
  await ensureProjectSocialColumns();
  const now = Date.now();
  const out = new Map<string, number | null>();

  for (const p of projects) {
    out.set(p.id, field === "discord" ? p.discordMembers : p.twitterFollowers);
  }

  const stale = projects.filter((p) => {
    const cached = field === "discord" ? p.discordMembers : p.twitterFollowers;
    const hasUrl = field === "discord" ? !!p.discordUrl?.trim() : !!p.twitterUrl?.trim();
    if (!hasUrl) return false;
    if (cached == null) return true;
    if (!p.socialCountsAt) return true;
    return now - p.socialCountsAt.getTime() > SOCIAL_CACHE_TTL_MS;
  });

  await mapPool(stale, SOCIAL_REFRESH_CONCURRENCY, async (p) => {
    try {
      if (field === "discord") {
        const n = await fetchDiscordMemberCount(p.discordUrl);
        if (n != null) {
          out.set(p.id, n);
          await prisma.project.update({
            where: { id: p.id },
            data: { discordMembers: n, socialCountsAt: new Date() },
          });
        }
      } else {
        const n = await fetchXFollowerCount(p.twitterUrl);
        if (n != null) {
          out.set(p.id, n);
          await prisma.project.update({
            where: { id: p.id },
            data: { twitterFollowers: n, socialCountsAt: new Date() },
          });
        }
      }
    } catch (e) {
      console.warn(`[project-social] refresh ${field} failed for ${p.id}:`, e);
    }
  });

  return out;
}
