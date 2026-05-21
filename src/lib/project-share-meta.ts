/** Site origin for absolute Open Graph / Twitter image URLs */
export function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://slotto.gg";
}

const DEFAULT_SHARE_IMAGE = "/brand/slotto-tickets.png";
const DESCRIPTION_MAX = 200;

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

/** Prefer wide banner for large cards; fall back to listing thumbnail, then site default */
export function projectShareImageUrl(
  bannerImageUrl: string | null | undefined,
  listingImageUrl: string | null | undefined,
  siteUrl = getSiteUrl(),
): string {
  const raw = bannerImageUrl?.trim() || listingImageUrl?.trim();
  if (!raw) return absoluteAssetUrl(DEFAULT_SHARE_IMAGE, siteUrl);
  return absoluteAssetUrl(raw, siteUrl);
}
