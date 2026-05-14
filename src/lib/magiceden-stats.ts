import { fetchCollectionNftCountViaHelius } from "@/lib/helius-collection-nft-count";

const ME_API = "https://api-mainnet.magiceden.dev/v2";
const LAMPORTS_PER_SOL = 1e9;

type MeStats = {
  symbol?: string;
  floorPrice?: number;
  listedCount?: number;
  avgPrice24hr?: number;
  volumeAll?: number;
  /** Present on some ME v2 responses */
  totalSupply?: number;
  supply?: number;
  size?: number;
  nftCount?: number;
  count?: number;
};

type MeCollection = Record<string, unknown>;

export type LiveMeStats = {
  symbol: string | null;
  floorSol: string | null;
  listings: string | null;
  volumeSol: string | null;
  avg24hSol: string | null;
  supply: string | null;
  ok: boolean;
  message: string | null;
};

function fmtSolLamports(lamports: number | undefined | null): string | null {
  if (lamports == null || !Number.isFinite(lamports)) return null;
  const sol = lamports / LAMPORTS_PER_SOL;
  if (sol >= 1_000_000) return `${(sol / 1_000_000).toFixed(2)}M`;
  if (sol >= 1_000) return `${(sol / 1_000).toFixed(2)}k`;
  if (sol >= 1) return sol.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
  if (sol >= 0.0001) return sol.toLocaleString("en-US", { maximumFractionDigits: 6 });
  return sol.toExponential(2);
}

function asSupplyRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

const SUPPLY_KEYS_SHALLOW = [
  "size",
  "totalSupply",
  "supply",
  "nftCount",
  "count",
  "totalItems",
  "numItems",
  "itemCount",
  "minted",
  "totalMints",
  "maxSupply",
  "collectionSize",
] as const;

/** Deeper JSON often has per-NFT `supply: 1` — never treat those as collection size. */
const SUPPLY_KEYS_DEEP = [
  "size",
  "totalSupply",
  "nftCount",
  "totalItems",
  "numItems",
  "itemCount",
  "minted",
  "totalMints",
  "maxSupply",
  "collectionSize",
] as const;

const NEST_KEYS = ["onChainCollectionData", "chainCollectionData", "collection"] as const;

/** Read total supply from collection / stats JSON (skips token metadata nests). */
function pickSupplyFromObject(obj: Record<string, unknown> | null, depth = 0): string | null {
  if (!obj || depth > 4) return null;
  const keys = depth === 0 ? SUPPLY_KEYS_SHALLOW : SUPPLY_KEYS_DEEP;
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) return String(Math.round(v));
    if (typeof v === "string" && /^\d+$/.test(v.trim())) return v.trim();
  }
  for (const nk of NEST_KEYS) {
    const nested = asSupplyRecord(obj[nk]);
    const s = pickSupplyFromObject(nested, depth + 1);
    if (s) return s;
  }
  return null;
}

function pickSupply(col: MeCollection | null): string | null {
  return pickSupplyFromObject(asSupplyRecord(col), 0);
}

function pickSupplyFromStats(stats: MeStats | null): string | null {
  if (!stats) return null;
  return pickSupplyFromObject(asSupplyRecord(stats), 0);
}

/** ME-listed count cannot exceed true total supply — reject bogus JSON (e.g. per-NFT supply 1). */
function isImplausibleSupplyVsListings(supplyStr: string | null, listedCount: number | null): boolean {
  if (!supplyStr) return false;
  const s = Number(supplyStr);
  if (!Number.isFinite(s) || s < 1) return true;
  if (listedCount == null || !Number.isFinite(listedCount) || listedCount < 1) return false;
  return s < listedCount;
}

/** Ordered Magic Eden collection URLs: `meUrls` JSON array, else legacy `meUrl`. */
export function magicEdenCollectionUrls(meUrls: unknown, meUrl: string | null | undefined): string[] {
  const out: string[] = [];
  if (Array.isArray(meUrls)) {
    for (const x of meUrls) {
      if (typeof x === "string" && x.trim()) out.push(x.trim());
    }
  }
  if (out.length === 0 && meUrl?.trim()) out.push(meUrl.trim());
  return out;
}

export function primaryMagicEdenUrl(meUrls: unknown, meUrl: string | null | undefined): string | null {
  const urls = magicEdenCollectionUrls(meUrls, meUrl);
  return urls[0] ?? null;
}

/** Extract ME collection symbol from a Magic Eden marketplace URL. */
export function parseMagicEdenCollectionSymbol(meUrl: string): string | null {
  const raw = meUrl.trim();
  if (!raw) return null;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./i, "").toLowerCase();
  if (!host.endsWith("magiceden.io") && !host.endsWith("magiceden.us")) {
    return null;
  }
  const path = u.pathname.replace(/\/+$/, "");
  const m =
    path.match(/\/marketplace\/([^/]+)/i) ??
    path.match(/\/collections\/([^/]+)/i);
  if (!m?.[1]) return null;
  const sym = decodeURIComponent(m[1]).trim();
  return sym || null;
}

async function fetchJson<T>(url: string, revalidateSec: number): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: revalidateSec },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Live stats from Magic Eden (floor, listings, volume, 24h avg, optional supply).
 * Pass the primary collection Magic Eden URL (first line of `meUrls`, or legacy `meUrl`).
 */
export async function fetchLiveMagicEdenStats(
  meUrl: string | null | undefined,
  revalidateSec = 120,
): Promise<LiveMeStats> {
  const symbol = meUrl ? parseMagicEdenCollectionSymbol(meUrl) : null;
  if (!meUrl?.trim()) {
    return {
      symbol: null,
      floorSol: null,
      listings: null,
      volumeSol: null,
      avg24hSol: null,
      supply: null,
      ok: false,
      message: "Add a Magic Eden collection URL to show live stats.",
    };
  }
  if (!symbol) {
    return {
      symbol: null,
      floorSol: null,
      listings: null,
      volumeSol: null,
      avg24hSol: null,
      supply: null,
      ok: false,
      message:
        "Use a Magic Eden link that includes /marketplace/collection-name or /collections/collection-name.",
    };
  }

  const statsUrl = `${ME_API}/collections/${encodeURIComponent(symbol)}/stats`;
  const collectionUrl = `${ME_API}/collections/${encodeURIComponent(symbol)}`;

  const [stats, collection] = await Promise.all([
    fetchJson<MeStats>(statsUrl, revalidateSec),
    fetchJson<MeCollection>(collectionUrl, revalidateSec),
  ]);

  const listedRounded =
    stats?.listedCount != null && Number.isFinite(stats.listedCount) ? Math.round(stats.listedCount) : null;

  let supply = pickSupply(collection) ?? pickSupplyFromStats(stats);
  if (isImplausibleSupplyVsListings(supply, listedRounded)) {
    supply = null;
  }
  if (!supply) {
    supply = await fetchCollectionNftCountViaHelius(symbol, collection, revalidateSec, listedRounded);
  }

  if (!stats || (stats.floorPrice == null && stats.listedCount == null && stats.volumeAll == null)) {
    return {
      symbol,
      floorSol: null,
      listings: null,
      volumeSol: null,
      avg24hSol: null,
      supply,
      ok: false,
      message: "Magic Eden did not return stats for this collection. Check the URL or try again later.",
    };
  }

  return {
    symbol: stats.symbol ?? symbol,
    floorSol: fmtSolLamports(stats.floorPrice),
    listings:
      stats.listedCount != null && Number.isFinite(stats.listedCount)
        ? String(Math.round(stats.listedCount))
        : null,
    volumeSol: fmtSolLamports(stats.volumeAll),
    avg24hSol: fmtSolLamports(stats.avgPrice24hr),
    supply,
    ok: true,
    message: null,
  };
}
