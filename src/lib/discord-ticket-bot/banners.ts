import { getSiteUrl } from "@/lib/site-metadata";

const SALE_BANNERS: Record<string, string> = {
  SOL: "sale-sol.JPG",
  DEADS: "sale-deads.PNG",
  BLUNANA: "sale-blunana.JPG",
  SERUMX: "sale-serumx.JPG",
  LDZ: "sale-ldz.JPG",
  EMPIRE: "sale-empire.JPG",
  RYC: "sale-ryc.JPG",
};

function socialBannerUrl(filename: string): string {
  const base = getSiteUrl().replace(/\/$/, "") || "https://slotto.gg";
  return `${base}/socials/${filename}`;
}

export function drawStartBannerUrl(): string {
  return socialBannerUrl("start.PNG");
}

export function drawWinnerBannerUrl(): string {
  return socialBannerUrl("winner.GIF");
}

/** Token symbol → full-width Discord embed image (falls back to token logo elsewhere). */
export function ticketSaleBannerUrl(tokenSymbol: string): string | null {
  const file = SALE_BANNERS[tokenSymbol.trim().toUpperCase()];
  return file ? socialBannerUrl(file) : null;
}
