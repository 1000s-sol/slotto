/** Static assets under `public/marketplaces/`. */
export const MARKETPLACE_ICON = {
  magicEden: "/marketplaces/magic-eden.png",
  tensor: "/marketplaces/tensor.png",
} as const;

/** Icon URL for a marketplace `href`, or `null` for a generic link chip. */
export function marketplaceIconForHref(href: string): string | null {
  try {
    const host = new URL(href).hostname.replace(/^www\./i, "").toLowerCase();
    if (host.endsWith("magiceden.io") || host.endsWith("magiceden.us")) {
      return MARKETPLACE_ICON.magicEden;
    }
    if (host.endsWith("tensor.trade") || host.endsWith("tensor.xyz")) {
      return MARKETPLACE_ICON.tensor;
    }
    return null;
  } catch {
    return null;
  }
}
