import { NextResponse } from "next/server";

/** Wrapped SOL — DexScreener / Jupiter “SOL” spot price */
const SOL_MINT = "So11111111111111111111111111111111111111112";

const TRACKED_MINTS = [
  SOL_MINT,
  "7ztGsbEkbSzeeUgm3SwCp6hkmaJe3Gwi4zgvANKSfYML",
  "E5ZVeBMazQAYq4UEiSNRLxfMeRds9SKL31yPan7j5GJK",
  "C9vfeaCLhJy7sykgKnfzi6RikawQNoGtRKwsaupKavmV",
  "EmpirdtfUMfBQXEjnNmTngeimjfizfuSBD3TN9zqzydj",
  "64vQ6Km98vEZnz7a1MmgMjsaDYUL7RaLJCDmRiggBAGS",
  "FPTaXcvgE4Jwf5NK4tLcZAqPqHooPgFxZ8yWbEaTZ6W5",
] as const;

/** DexScreener batch can omit thin pools — keep display names stable */
const KNOWN_SYMBOLS: Record<string, string> = {
  C9vfeaCLhJy7sykgKnfzi6RikawQNoGtRKwsaupKavmV: "BLUNANA",
};

export type TickerItem = {
  mint: string;
  symbol: string;
  priceUsd: number | null;
  logoUrl: string | null;
};

type DexRow = {
  baseToken: { address: string; symbol?: string; name?: string };
  priceUsd?: string;
  info?: { imageUrl?: string };
};

type HeliusMeta = { symbol?: string; image?: string };

function abbrevMint(mint: string) {
  return `${mint.slice(0, 4)}…${mint.slice(-4)}`;
}

/** Many token images are ipfs:// — img src needs https gateway */
function normalizeImageUrl(url: string | undefined): string | null {
  if (!url) return null;
  const u = url.trim();
  if (!u) return null;
  if (u.startsWith("ipfs://")) return `https://ipfs.io/ipfs/${u.slice(7)}`;
  if (u.startsWith("http://") || u.startsWith("https://") || u.startsWith("data:")) return u;
  return u;
}

async function fetchJupiterUsd(mints: readonly string[]): Promise<Record<string, number | null>> {
  const out: Record<string, number | null> = {};
  for (const m of mints) out[m] = null;
  try {
    const url = `https://api.jup.ag/price/v3/price?ids=${mints.join(",")}`;
    const res = await fetch(url, { next: { revalidate: 30 } });
    if (!res.ok) return out;
    const json = (await res.json()) as Record<string, { usdPrice?: number } | undefined>;
    for (const m of mints) {
      const p = json[m]?.usdPrice;
      out[m] = typeof p === "number" && Number.isFinite(p) ? p : null;
    }
  } catch {
    /* keep nulls */
  }
  return out;
}

async function fetchHeliusMeta(mint: string): Promise<HeliusMeta | null> {
  const key = process.env.HELIUS_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(`https://mainnet.helius-rpc.com/?api-key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "slotto-ticker",
        method: "getAsset",
        params: {
          id: mint,
          displayOptions: { showFungible: true },
        },
      }),
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { result?: Record<string, unknown> };
    const r = json.result as Record<string, unknown> | undefined;
    if (!r) return null;
    const content = r.content as Record<string, unknown> | undefined;
    const metadata = content?.metadata as Record<string, unknown> | undefined;
    const links = content?.links as Record<string, unknown> | undefined;
    const tokenInfo = r.token_info as Record<string, unknown> | undefined;
    const files = content?.files as Array<{ uri?: string; mime?: string }> | undefined;

    const symRaw =
      (metadata?.symbol as string | undefined)?.trim() ||
      (tokenInfo?.symbol as string | undefined)?.trim();

    const rawImage =
      (links?.image as string | undefined)?.trim() ||
      (typeof metadata?.image === "string" ? metadata.image.trim() : undefined) ||
      files?.find((f) => f.uri && (!f.mime || f.mime.startsWith("image/")))?.uri?.trim() ||
      files?.[0]?.uri?.trim();

    const image = normalizeImageUrl(rawImage);

    return {
      symbol: symRaw || undefined,
      image: image || undefined,
    };
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const [dexRes, jupUsd] = await Promise.all([
      fetch(
        `https://api.dexscreener.com/tokens/v1/solana/${TRACKED_MINTS.join(",")}`,
        { headers: { Accept: "application/json" }, next: { revalidate: 30 } },
      ),
      fetchJupiterUsd(TRACKED_MINTS),
    ]);

    const byMint = new Map<string, DexRow>();
    if (dexRes.ok) {
      const data = (await dexRes.json()) as DexRow[];
      for (const row of data) {
        const addr = row.baseToken?.address;
        if (addr && !byMint.has(addr)) byMint.set(addr, row);
      }
    }

    /** Helius backfills logos (and symbols) when Dex has no image or no row */
    const needsHelius = TRACKED_MINTS.filter((mint) => {
      const row = byMint.get(mint);
      return !row?.info?.imageUrl?.trim();
    });

    const heliusMap = new Map<string, HeliusMeta | null>();
    await Promise.all(
      needsHelius.map(async (mint) => {
        heliusMap.set(mint, await fetchHeliusMeta(mint));
      }),
    );

    const items: TickerItem[] = TRACKED_MINTS.map((mint) => {
      const row = byMint.get(mint);
      const helius = heliusMap.get(mint) ?? null;

      const rawDex = row?.priceUsd;
      const dexPrice =
        rawDex !== undefined && rawDex !== null && rawDex !== ""
          ? Number(rawDex)
          : NaN;
      const jupPrice = jupUsd[mint];
      const priceUsd = Number.isFinite(dexPrice)
        ? dexPrice
        : jupPrice != null && Number.isFinite(jupPrice)
          ? jupPrice
          : null;

      let symbol =
        mint === SOL_MINT
          ? "SOL"
          : row?.baseToken?.symbol?.trim() ||
            helius?.symbol?.trim() ||
            KNOWN_SYMBOLS[mint] ||
            abbrevMint(mint);

      if (mint !== SOL_MINT && symbol.length > 12) {
        symbol = symbol.slice(0, 12);
      }

      const dexLogo = normalizeImageUrl(row?.info?.imageUrl);
      const heliusLogo = normalizeImageUrl(helius?.image);
      const logoUrl = dexLogo || heliusLogo || null;

      return { mint, symbol, priceUsd, logoUrl };
    });

    return NextResponse.json(
      { items },
      { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } },
    );
  } catch {
    return NextResponse.json({
      items: TRACKED_MINTS.map((mint) => ({
        mint,
        symbol: mint === SOL_MINT ? "SOL" : abbrevMint(mint),
        priceUsd: null,
        logoUrl: null,
      })),
    });
  }
}
