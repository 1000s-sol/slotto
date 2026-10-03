import type { LiveMeStats } from "@/lib/magiceden-stats";

const ORBIS_COLLECTIONS_URL =
  "https://www.orbisonsol.io/api/marketplace?action=getCollections";

type OrbisCollectionStats = {
  floorPrice?: number;
  listed?: number;
  volumeAll?: number;
  volume24h?: number;
  sales24h?: number;
  supply?: number;
};

type OrbisCollection = {
  name?: string;
  pathname?: string;
  stats?: OrbisCollectionStats;
};

type OrbisCollectionsResponse = {
  success?: boolean;
  collections?: OrbisCollection[];
};

/** Extract Orbis marketplace pathname from a collection URL. */
export function parseOrbisCollectionPathname(orbisUrl: string): string | null {
  const raw = orbisUrl.trim();
  if (!raw) return null;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./i, "").toLowerCase();
  if (!host.endsWith("orbisonsol.io") && host !== "orbis.gg") {
    return null;
  }
  const path = u.pathname.replace(/\/+$/, "");
  const m = path.match(/\/marketplace\/([^/]+)/i);
  if (!m?.[1]) return null;
  const pathname = decodeURIComponent(m[1]).trim().toLowerCase();
  return pathname || null;
}

function fmtSol(sol: number | undefined | null): string | null {
  if (sol == null || !Number.isFinite(sol)) return null;
  if (sol >= 1_000_000) return `${(sol / 1_000_000).toFixed(2)}M`;
  if (sol >= 1_000) return `${(sol / 1_000).toFixed(2)}k`;
  if (sol >= 1) return sol.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
  if (sol >= 0.0001) return sol.toLocaleString("en-US", { maximumFractionDigits: 6 });
  return sol.toExponential(2);
}

async function fetchOrbisCollections(revalidateSec: number): Promise<OrbisCollection[]> {
  try {
    const res = await fetch(ORBIS_COLLECTIONS_URL, {
      headers: { Accept: "application/json" },
      next: { revalidate: revalidateSec },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as OrbisCollectionsResponse;
    return Array.isArray(data.collections) ? data.collections : [];
  } catch {
    return [];
  }
}

/**
 * Live stats from Orbis (floor, listings, volume, optional 24h avg + supply).
 * Orbis reports prices/volumes in SOL (not lamports).
 */
export async function fetchLiveOrbisStats(
  orbisUrl: string | null | undefined,
  revalidateSec = 120,
): Promise<LiveMeStats> {
  const pathname = orbisUrl ? parseOrbisCollectionPathname(orbisUrl) : null;
  if (!orbisUrl?.trim()) {
    return {
      symbol: null,
      floorSol: null,
      listings: null,
      volumeSol: null,
      avg24hSol: null,
      supply: null,
      ok: false,
      message: "Add an Orbis collection URL to show live stats.",
    };
  }
  if (!pathname) {
    return {
      symbol: null,
      floorSol: null,
      listings: null,
      volumeSol: null,
      avg24hSol: null,
      supply: null,
      ok: false,
      message:
        "Use an Orbis link that includes /marketplace/collection-name.",
    };
  }

  const collections = await fetchOrbisCollections(revalidateSec);
  const match = collections.find(
    (c) => typeof c.pathname === "string" && c.pathname.trim().toLowerCase() === pathname,
  );
  const stats = match?.stats;
  if (
    !stats ||
    (stats.floorPrice == null && stats.listed == null && stats.volumeAll == null)
  ) {
    return {
      symbol: pathname,
      floorSol: null,
      listings: null,
      volumeSol: null,
      avg24hSol: null,
      supply: null,
      ok: false,
      message: "Orbis did not return stats for this collection. Check the URL or try again later.",
    };
  }

  let avg24hSol: string | null = null;
  if (
    stats.volume24h != null &&
    Number.isFinite(stats.volume24h) &&
    stats.sales24h != null &&
    Number.isFinite(stats.sales24h) &&
    stats.sales24h > 0
  ) {
    avg24hSol = fmtSol(stats.volume24h / stats.sales24h);
  }

  const supply =
    stats.supply != null && Number.isFinite(stats.supply) && stats.supply >= 0
      ? String(Math.round(stats.supply))
      : null;

  return {
    symbol: match?.name?.trim() || pathname,
    floorSol: fmtSol(stats.floorPrice),
    listings:
      stats.listed != null && Number.isFinite(stats.listed)
        ? String(Math.round(stats.listed))
        : null,
    volumeSol: fmtSol(stats.volumeAll),
    avg24hSol,
    supply,
    ok: true,
    message: null,
  };
}
