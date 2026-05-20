/** Normalize and build profile URLs for linked Discord / X on draws and winner UI. */

export type SocialProfile = {
  username: string;
  avatarUrl: string | null;
  profileUrl: string | null;
};

export type WalletSocialPublic = {
  discord: SocialProfile | null;
  x: SocialProfile | null;
};

export function normalizeXHandle(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  let h = s.replace(/^@/, "");
  try {
    const u = new URL(h.startsWith("http") ? h : `https://${h}`);
    if (u.hostname === "x.com" || u.hostname === "twitter.com") {
      const seg = u.pathname.split("/").filter(Boolean)[0];
      if (seg && !["home", "intent", "share"].includes(seg)) h = seg;
    }
  } catch {
    /* plain handle */
  }
  h = h.replace(/^@/, "").replace(/\/$/, "");
  if (!/^[A-Za-z0-9_]{1,15}$/.test(h)) return null;
  return h;
}

export function xProfileUrl(handle: string | null | undefined): string | null {
  if (!handle) return null;
  const h = normalizeXHandle(handle);
  return h ? `https://x.com/${h}` : null;
}

export function xAvatarFallback(handle: string): string {
  const h = normalizeXHandle(handle) ?? handle;
  return `https://unavatar.io/x/${encodeURIComponent(h)}`;
}

export function discordDefaultAvatar(discordId: string): string {
  try {
    const id = BigInt(discordId);
    const index = Number((id >> 22n) % 6n);
    return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
  } catch {
    return "https://cdn.discordapp.com/embed/avatars/0.png";
  }
}

export function discordProfileUrlFromId(discordId: string): string {
  return `https://discord.com/users/${discordId}`;
}
