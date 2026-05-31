import type { Metadata } from "next";

/** Default Open Graph / Twitter card image (public/brand/slotto-tickets1.png). */
export const SITE_SHARE_IMAGE = "/brand/slotto-tickets1.png";

export const SITE_NAME = "Slotto";

export const SITE_TITLE = "Slotto — monthly lottery on Solana";

export const SITE_DESCRIPTION =
  "Monthly on-chain lottery on Solana. Buy tickets with SOL or featured project tokens. Transparent draws, verified winners, and curated project listings.";

/** Canonical origin for absolute OG image URLs (defaults to production domain). */
export function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://slotto.gg";
}

/**
 * URL appended to official @slottogg_ draw posts. Defaults to slotto.gg so preview
 * deploys (vercel.app) do not leak into public tweets when NEXT_PUBLIC_SITE_URL
 * points at a staging URL.
 */
export function getAnnounceSiteUrl(): string {
  return process.env.LOTTERY_ANNOUNCE_SITE_URL?.trim() || "https://slotto.gg";
}

export function siteOpenGraphImages(siteUrl = getSiteUrl()) {
  const base = siteUrl.replace(/\/$/, "");
  return [
    {
      url: `${base}${SITE_SHARE_IMAGE}`,
      width: 1254,
      height: 1254,
      alt: "Slotto — monthly lottery on Solana",
    },
  ];
}

export const rootSiteMetadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: SITE_TITLE,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: siteOpenGraphImages(),
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [SITE_SHARE_IMAGE],
  },
};
