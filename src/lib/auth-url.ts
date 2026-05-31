import { getSiteUrl } from "@/lib/site-metadata";

function hostKey(origin: string): string | null {
  try {
    const host = new URL(origin).hostname.toLowerCase();
    return host.startsWith("www.") ? host.slice(4) : host;
  } catch {
    return null;
  }
}

function siteIsCustomDomain(site: string): boolean {
  return (
    site.length > 0 &&
    !site.includes(".vercel.app") &&
    !site.includes("localhost")
  );
}

/** Canonical origin for Auth.js OAuth redirects (no trailing slash). */
export function resolveAuthUrl(): string {
  const site = getSiteUrl().replace(/\/$/, "");
  const explicit = (
    process.env.AUTH_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    ""
  ).replace(/\/$/, "");
  const customSite = siteIsCustomDomain(site);

  // Prefer NEXT_PUBLIC_SITE_URL when AUTH_URL is the same domain with/without www.
  if (explicit && customSite && hostKey(explicit) === hostKey(site)) {
    return site;
  }

  // Honor an explicit custom-domain AUTH_URL for a different host.
  if (explicit && !explicit.includes(".vercel.app")) {
    return explicit;
  }

  // Vercel often sets AUTH_URL / NEXTAUTH_URL to *.vercel.app — override for production.
  if (explicit.includes(".vercel.app") && customSite) {
    return site;
  }

  if (explicit) return explicit;

  if (customSite) return site;

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    const host = vercel.replace(/^https?:\/\//, "");
    return `https://${host}`;
  }

  return site || "https://slotto.gg";
}

/** Normalize AUTH_URL / NEXTAUTH_URL before Auth.js reads them. */
export function ensureAuthUrlEnv(): void {
  const url = resolveAuthUrl();
  process.env.AUTH_URL = url;
  process.env.NEXTAUTH_URL = url;
}
