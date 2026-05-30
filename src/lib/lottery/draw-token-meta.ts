import { fetchHeliusTokenMeta, normalizeImageUrl } from "@/lib/helius-token-meta";
import { WRAPPED_SOL_MINT } from "@/lib/token-usd-prices";

import { fetchPublishedProjectTokens } from "./project-tokens-for-draw";
import { fetchSplMintRowsForDraw } from "./spl-catalog-db";

/** Canonical SOL logo (Solana token-list). */
const SOL_LOGO_URL =
  "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png";

export type DrawTokenMeta = {
  mint: string;
  symbol: string;
  name: string;
  imageUrl: string | null;
  liquid: boolean;
};

function abbrevMint(mint: string): string {
  return `${mint.slice(0, 4)}…${mint.slice(-4)}`;
}

/**
 * Display metadata (symbol, name, logo) for every payment token on a draw:
 * native SOL plus each configured SPL mint. Non-liquid project tokens use the
 * image saved in project info; liquid tokens fall back to Helius DAS metadata.
 */
export async function buildDrawTokenMeta(
  drawId: number,
): Promise<Record<string, DrawTokenMeta>> {
  const [rows, projects] = await Promise.all([
    fetchSplMintRowsForDraw(drawId),
    fetchPublishedProjectTokens(),
  ]);

  const projByMint = new Map(projects.map((p) => [p.mint, p]));
  const out: Record<string, DrawTokenMeta> = {};

  out[WRAPPED_SOL_MINT] = {
    mint: WRAPPED_SOL_MINT,
    symbol: "SOL",
    name: "Solana",
    imageUrl: SOL_LOGO_URL,
    liquid: true,
  };

  await Promise.all(
    rows.map(async (r) => {
      const p = projByMint.get(r.mint);
      const liquid = p?.liquid ?? true;

      let symbol = r.symbol?.trim() || p?.tokenName?.trim() || "";
      let name =
        p?.tokenName?.trim() || p?.projectName?.trim() || symbol || abbrevMint(r.mint);
      let imageUrl = normalizeImageUrl(p?.tokenImageUrl ?? undefined);

      if (!imageUrl || !symbol) {
        const helius = await fetchHeliusTokenMeta(r.mint).catch(() => null);
        if (!imageUrl) imageUrl = normalizeImageUrl(helius?.image);
        if (!symbol) symbol = helius?.symbol?.trim() || abbrevMint(r.mint);
      }

      if (!symbol) symbol = abbrevMint(r.mint);
      if (!name) name = symbol;

      out[r.mint] = { mint: r.mint, symbol, name, imageUrl, liquid };
    }),
  );

  return out;
}
