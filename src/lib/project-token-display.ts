import { fetchHeliusTokenMeta, normalizeImageUrl } from "@/lib/helius-token-meta";

function abbrevMint(mint: string) {
  return `${mint.slice(0, 4)}…${mint.slice(-4)}`;
}

type DexRow = {
  baseToken: { address: string; symbol?: string };
  info?: { imageUrl?: string };
};

export type ProjectTokenDisplayOpts = {
  liquid?: boolean;
  tokenImageUrl?: string | null;
  tokenName?: string | null;
};

/** Hosts that often 404 or hang for SPL token icons in browsers. */
function isUnreliableTokenImageHost(url: string | null): boolean {
  if (!url) return true;
  const u = url.toLowerCase();
  return (
    u.includes("shdw-drive.genesysgo.net") ||
    u.includes("genesysgo.net") ||
    u.startsWith("ipfs://") ||
    /\/ipfs\//i.test(u) ||
    u.includes("gateway.pinata.cloud")
  );
}

/** Same-origin / relative paths are served by us — treat as reachable. */
function isLocalAssetUrl(url: string): boolean {
  return url.startsWith("/") && !url.startsWith("//");
}

async function urlLooksReachable(url: string): Promise<boolean> {
  if (isLocalAssetUrl(url)) return true;
  try {
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(2500),
      next: { revalidate: 3600 },
    });
    if (res.ok) return true;
    // Some CDNs reject HEAD; try a tiny GET range.
    if (res.status === 405 || res.status === 403 || res.status === 400) {
      const get = await fetch(url, {
        method: "GET",
        headers: { Range: "bytes=0-0" },
        redirect: "follow",
        signal: AbortSignal.timeout(2500),
        next: { revalidate: 3600 },
      });
      return get.ok || get.status === 206;
    }
    return false;
  } catch {
    return false;
  }
}

async function firstReachableLogo(candidates: Array<string | null | undefined>): Promise<string | null> {
  const seen = new Set<string>();
  for (const raw of candidates) {
    const url = raw?.trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    if (await urlLooksReachable(url)) return url;
  }
  return null;
}

async function fetchGeckoTerminalLogo(
  mint: string,
): Promise<{ logo: string | null; symbol?: string }> {
  try {
    const res = await fetch(
      `https://api.geckoterminal.com/api/v2/networks/solana/tokens/${encodeURIComponent(mint)}`,
      { headers: { Accept: "application/json" }, next: { revalidate: 3600 } },
    );
    if (!res.ok) return { logo: null };
    const json = (await res.json()) as {
      data?: { attributes?: { symbol?: string; image_url?: string | null } };
    };
    const attrs = json.data?.attributes;
    return {
      logo: normalizeImageUrl(attrs?.image_url ?? undefined),
      symbol: attrs?.symbol?.trim(),
    };
  } catch {
    return { logo: null };
  }
}

/** Symbol + logo for a project token mint (DexScreener + Helius + Gecko, same spirit as ticker). */
export async function fetchProjectTokenDisplay(
  mint: string,
  opts?: ProjectTokenDisplayOpts,
): Promise<{
  symbol: string;
  logoUrl: string | null;
}> {
  const m = mint.trim();
  if (!m) return { symbol: "", logoUrl: null };

  const nonLiquid = opts?.liquid === false;
  const storedLogo = opts?.tokenImageUrl?.trim()
    ? normalizeImageUrl(opts.tokenImageUrl.trim())
    : null;
  // Non-liquid tokens prefer the admin-uploaded logo first.
  const customLogo = nonLiquid ? storedLogo : null;
  const customName = nonLiquid && opts.tokenName?.trim() ? opts.tokenName.trim() : null;

  if (customName) {
    const logoUrl = customLogo ?? null;
    if (logoUrl) return { symbol: customName, logoUrl };
    // still resolve logo from chain if no custom image was stored yet
  }

  let dexSymbol: string | undefined;
  let dexLogo: string | null = null;
  try {
    const res = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${m}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 300 },
    });
    if (res.ok) {
      const data = (await res.json()) as DexRow[];
      const row = Array.isArray(data)
        ? data.find((r) => r.baseToken?.address === m) ?? data[0]
        : undefined;
      dexSymbol = row?.baseToken?.symbol?.trim();
      dexLogo = normalizeImageUrl(row?.info?.imageUrl);
    }
  } catch {
    /* keep fallbacks */
  }

  const needsHelius = !customLogo && (!dexLogo || !dexSymbol);
  const helius = needsHelius ? await fetchHeliusTokenMeta(m) : null;
  const heliusLogo = normalizeImageUrl(helius?.image);

  const hasReliableMarketLogo =
    Boolean(customLogo) ||
    (Boolean(dexLogo) && !isUnreliableTokenImageHost(dexLogo)) ||
    (Boolean(heliusLogo) && !isUnreliableTokenImageHost(heliusLogo));

  let geckoLogo: string | null = null;
  let geckoSymbol: string | undefined;
  if (!hasReliableMarketLogo) {
    const gecko = await fetchGeckoTerminalLogo(m);
    geckoLogo = gecko.logo;
    geckoSymbol = gecko.symbol;
  }

  // Prefer stable CDN / stored logos over GenesysGo shadow-drive + IPFS (often 404 in browsers).
  // Also skip URLs that already 404 (e.g. expired Firebase tokenImageUrl).
  const reliableDex = dexLogo && !isUnreliableTokenImageHost(dexLogo) ? dexLogo : null;
  const reliableHelius = heliusLogo && !isUnreliableTokenImageHost(heliusLogo) ? heliusLogo : null;
  const logoUrl = await firstReachableLogo([
    customLogo,
    reliableDex,
    storedLogo,
    geckoLogo,
    reliableHelius,
    dexLogo,
    heliusLogo,
  ]);

  let symbol =
    customName || dexSymbol || helius?.symbol?.trim() || geckoSymbol || abbrevMint(m);
  if (symbol.length > 12) symbol = symbol.slice(0, 12);

  return { symbol, logoUrl };
}
