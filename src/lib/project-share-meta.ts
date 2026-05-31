import { headers } from "next/headers";

import { getSiteUrl, siteShareImageUrl } from "@/lib/site-metadata";

/** Prefer the request host so og:url matches the link being shared */
export async function getRequestSiteUrl(): Promise<string> {
  const h = await headers();
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").split(",")[0]?.trim();
  if (host) {
    const proto = (h.get("x-forwarded-proto") ?? "https").split(",")[0]?.trim() || "https";
    return `${proto}://${host}`;
  }
  return getSiteUrl();
}

const DESCRIPTION_MAX = 200;

/** Hosts that block hotlinking — unusable for Discord / X / iMessage previews */
const OG_IMAGE_HOST_BLOCKLIST = [
  "pbs.twimg.com",
  "twimg.com",
  "discordapp.com",
  "discord.com",
  "cdn.discordapp.com",
  "media.discordapp.net",
];

function isEmbeddableImageUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return !OG_IMAGE_HOST_BLOCKLIST.some((b) => host === b || host.endsWith(`.${b}`));
  } catch {
    return false;
  }
}

/** Plain-text excerpt from project review for link previews */
export function projectShareDescription(reviewMd: string): string {
  const plain = reviewMd
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\r\n/g, "\n")
    .trim();

  const firstBlock = plain.split(/\n\n+/)[0]?.replace(/\s+/g, " ").trim() ?? plain.replace(/\s+/g, " ").trim();
  if (firstBlock.length <= DESCRIPTION_MAX) return firstBlock;
  const cut = firstBlock.slice(0, DESCRIPTION_MAX - 1).trimEnd();
  const lastSpace = cut.lastIndexOf(" ");
  const trimmed = lastSpace > DESCRIPTION_MAX * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${trimmed}…`;
}

function absoluteAssetUrl(path: string, siteUrl: string): string {
  const base = siteUrl.replace(/\/$/, "");
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return path.startsWith("/") ? `${base}${path}` : `${base}/${path}`;
}

/** Prefer wide banner for large cards; skip Twitter/Discord URLs crawlers cannot fetch */
export function projectShareImageUrl(
  bannerImageUrl: string | null | undefined,
  listingImageUrl: string | null | undefined,
  siteUrl = getSiteUrl(),
): string {
  const fallback = siteShareImageUrl(siteUrl);
  const candidates = [bannerImageUrl?.trim(), listingImageUrl?.trim()].filter(Boolean) as string[];

  for (const raw of candidates) {
    const abs = absoluteAssetUrl(raw, siteUrl);
    if (isEmbeddableImageUrl(abs)) return abs;
  }

  return fallback;
}
