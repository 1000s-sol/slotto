/** Production maintenance gate for custom domains (slotto.gg). */

export const MAINTENANCE_COOKIE = "slotto_maintenance_bypass";

const DEFAULT_HOSTS = ["slotto.gg", "www.slotto.gg"];

export function maintenanceModeEnabled(): boolean {
  const raw = process.env.MAINTENANCE_MODE?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

export function maintenanceHosts(): string[] {
  const fromEnv = process.env.MAINTENANCE_HOSTS?.trim();
  if (!fromEnv) return DEFAULT_HOSTS;
  return fromEnv
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

export function isMaintenanceHostname(hostname: string): boolean {
  const host = hostname.split(":")[0]?.toLowerCase() ?? "";
  return maintenanceHosts().includes(host);
}

export function maintenanceApplies(hostname: string): boolean {
  return maintenanceModeEnabled() && isMaintenanceHostname(hostname);
}

export function maintenanceBypassSecret(): string | undefined {
  const s = process.env.MAINTENANCE_BYPASS_SECRET?.trim();
  return s && s.length >= 16 ? s : undefined;
}

export function isValidBypassKey(key: string | null | undefined): boolean {
  const secret = maintenanceBypassSecret();
  if (!secret || !key) return false;
  return key === secret;
}

/** Paths that stay reachable during maintenance (no redirect). */
export function isMaintenanceExemptPath(pathname: string): boolean {
  if (pathname === "/") return true;
  if (pathname.startsWith("/api/maintenance/")) return true;
  if (pathname.startsWith("/_next")) return true;
  if (pathname === "/favicon.ico" || pathname === "/robots.txt") return true;
  if (pathname.startsWith("/maintenance/")) return true;
  return false;
}

/** API routes that must work without a bypass cookie (cron, webhooks). */
export function isMaintenanceApiAllowlist(pathname: string): boolean {
  if (!pathname.startsWith("/api/")) return false;
  if (pathname.startsWith("/api/maintenance/")) return true;
  if (pathname.startsWith("/api/auth/")) return true;
  if (pathname.startsWith("/api/profile/")) return true;
  return (
    pathname === "/api/lottery/crank" ||
    pathname.startsWith("/api/lottery/crank/") ||
    pathname === "/api/ticker-prices"
  );
}
