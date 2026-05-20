/** Normalize and build profile URLs for linked Discord / X on draws and winner UI. */

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
  return `https://x.com/${handle}`;
}

export function normalizeDiscord(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  if (/^\d{17,20}$/.test(s)) return s;
  return s.replace(/^@/, "").slice(0, 64) || null;
}

export function discordProfileUrl(discord: string | null | undefined): string | null {
  if (!discord) return null;
  const s = discord.trim();
  if (/^https?:\/\//i.test(s)) return s;
  if (/^\d{17,20}$/.test(s)) return `https://discord.com/users/${s}`;
  return null;
}

export function discordDisplayLabel(discord: string | null | undefined): string | null {
  if (!discord) return null;
  const s = discord.trim();
  if (/^https?:\/\//i.test(s)) {
    try {
      const u = new URL(s);
      if (u.hostname.includes("discord.com") && u.pathname.startsWith("/users/")) {
        return "Discord profile";
      }
      return "Discord";
    } catch {
      return "Discord";
    }
  }
  if (/^\d{17,20}$/.test(s)) return "Discord";
  return s.startsWith("@") ? s : `@${s}`;
}

export type WalletSocialPublic = {
  discord: string | null;
  xHandle: string | null;
};
