import { normalizeXHandle } from "@/lib/social-profile-url";

const DEFAULT_REVALIDATE_SEC = 3600;

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
