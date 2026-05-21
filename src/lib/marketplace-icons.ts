/** Banner logos under `public/marketplace-logos/` (include marketplace name in image). */
export const MARKETPLACE_IDS = ["magicEden", "tensor", "gravemarket", "orbis"] as const;

export type MarketplaceId = (typeof MARKETPLACE_IDS)[number];

export const MARKETPLACE_LOGO: Record<MarketplaceId, string> = {
  magicEden: "/marketplace-logos/magiceden.png",
  tensor: "/marketplace-logos/tensor.png",
  gravemarket: "/marketplace-logos/gravemarket.png",
  orbis: "/marketplace-logos/orbis.png",
};

export const MARKETPLACE_LABEL: Record<MarketplaceId, string> = {
  magicEden: "Magic Eden",
  tensor: "Tensor",
  gravemarket: "Gravemarket",
  orbis: "Orbis",
};

export function isMarketplaceId(v: string): v is MarketplaceId {
  return (MARKETPLACE_IDS as readonly string[]).includes(v);
}

/** Guess marketplace from URL host (for migrating legacy free-form links). */
export function marketplaceIdFromHref(href: string): MarketplaceId | null {
  try {
    const host = new URL(href).hostname.replace(/^www\./i, "").toLowerCase();
    if (host.endsWith("magiceden.io") || host.endsWith("magiceden.us")) return "magicEden";
    if (host.endsWith("tensor.trade") || host.endsWith("tensor.xyz")) return "tensor";
    if (host.includes("gravemarket")) return "gravemarket";
    if (host.includes("orbis")) return "orbis";
    return null;
  } catch {
    return null;
  }
}

export function marketplaceLogo(id: MarketplaceId): string {
  return MARKETPLACE_LOGO[id];
}
