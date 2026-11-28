import { getSiteUrl } from "@/lib/site-metadata";

const SALE_BANNERS: Record<string, string> = {
  SOL: "sale-sol.JPG",
  DEADS: "sale-deads.PNG",
  BLUNANA: "sale-blunana.JPG",
  SERUMX: "sale-serumx.JPG",
  LDZ: "sale-ldz.JPG",
  EMPIRE: "sale-empire.JPG",
  RYC: "sale-ryc.JPG",
  FRENS: "sale-frens.PNG",
  BUX: "sale-bux.PNG",
  CSZ420: "sale-csz420.PNG",
};

/** Known SPL mints → banner/ticker key (catalog/dex labels often aren't the ticker). */
const SALE_BANNER_BY_MINT: Record<string, keyof typeof SALE_BANNERS> = {
  EmpirdtfUMfBQXEjnNmTngeimjfizfuSBD3TN9zqzydj: "EMPIRE",
};

function socialBannerUrl(filename: string): string {
  // Discord embed crawlers often fail on apex→www 308 redirects.
  let base = getSiteUrl().replace(/\/$/, "") || "https://www.slotto.gg";
  try {
    const u = new URL(base.includes("://") ? base : `https://${base}`);
    if (u.hostname === "slotto.gg") u.hostname = "www.slotto.gg";
    base = u.origin;
  } catch {
    base = "https://www.slotto.gg";
  }
  return `${base}/socials/${filename}`;
}

export function drawStartBannerUrl(): string {
  return socialBannerUrl("start.PNG");
}

export function drawWinnerBannerUrl(): string {
  return socialBannerUrl("winner.GIF");
}

/** Exact ticker only — never fuzzy-match labels (that mis-attributed EMPIRE). */
function bannerKeyFromSymbol(tokenSymbol: string): string | null {
  const raw = tokenSymbol.trim().toUpperCase();
  if (!raw) return null;
  return SALE_BANNERS[raw] ? raw : null;
}

/** Display ticker when payWith mint has a known sale banner. */
export function ticketSaleTickerForPayWith(
  payWithMint?: string | null,
): string | null {
  const mint = payWithMint?.trim();
  if (!mint || mint === "SOL") return mint === "SOL" ? "SOL" : null;
  return SALE_BANNER_BY_MINT[mint] ?? null;
}

/** Token symbol and/or mint → full-width Discord embed image. */
export function ticketSaleBannerUrl(
  tokenSymbol: string,
  payWithMint?: string | null,
): string | null {
  const mint = payWithMint?.trim();
  if (mint && mint !== "SOL") {
    const fromMint = SALE_BANNER_BY_MINT[mint];
    if (fromMint && SALE_BANNERS[fromMint]) {
      return socialBannerUrl(SALE_BANNERS[fromMint]!);
    }
  }
  const key = bannerKeyFromSymbol(tokenSymbol);
  if (!key) return null;
  const file = SALE_BANNERS[key];
  return file ? socialBannerUrl(file) : null;
}
