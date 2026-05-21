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

/** Symbol + logo for a project token mint (DexScreener + Helius, same spirit as ticker). */
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
  const customLogo =
    nonLiquid && opts.tokenImageUrl?.trim() ? opts.tokenImageUrl.trim() : null;
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
  const logoUrl = customLogo || dexLogo || heliusLogo || null;

  let symbol = customName || dexSymbol || helius?.symbol?.trim() || abbrevMint(m);
  if (symbol.length > 12) symbol = symbol.slice(0, 12);

  return { symbol, logoUrl };
}
