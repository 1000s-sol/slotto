import { fetchHeliusTokenMeta, normalizeImageUrl } from "@/lib/helius-token-meta";
import { fetchDexTokenRows, WRAPPED_SOL_MINT } from "@/lib/token-usd-prices";

import {
  FREE_ENTRY_IMAGE_PATH,
  FREE_ENTRY_NAME,
  FREE_ENTRY_SYMBOL,
  isFreeEntryMint,
} from "./free-entry";
import { fetchPublishedProjectTokens } from "./project-tokens-for-draw";
import { fetchSplMintRowsForDraw } from "./spl-catalog-db";

/** Canonical SOL logo (Solana token-list). */
const SOL_LOGO_URL =
  "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png";

export type DrawTokenMeta = {
  mint: string;
  /** On-chain / market ticker (e.g. CJT) — same source as the price ticker. */
  symbol: string;
  name: string;
  /** Project listing name for “TOKEN (Project)” labels. */
  projectName: string | null;
  imageUrl: string | null;
  liquid: boolean;
  projectXHandle: string | null;
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
  const dexByMint = await fetchDexTokenRows(rows.map((r) => r.mint));

  out[WRAPPED_SOL_MINT] = {
    mint: WRAPPED_SOL_MINT,
    symbol: "SOL",
    name: "Solana",
    projectName: null,
    imageUrl: SOL_LOGO_URL,
    liquid: true,
    projectXHandle: null,
  };

  await Promise.all(
    rows.map(async (r) => {
      // SLOTTO FREE ENTRY: fixed identity + bundled art, independent of Helius.
      if (isFreeEntryMint(r.mint)) {
        out[r.mint] = {
          mint: r.mint,
          symbol: FREE_ENTRY_SYMBOL,
          name: FREE_ENTRY_NAME,
          projectName: null,
          imageUrl: FREE_ENTRY_IMAGE_PATH,
          liquid: false,
          projectXHandle: null,
        };
        return;
      }

      const p = projByMint.get(r.mint);
      const liquid = p?.liquid ?? true;
      const splLabel = r.symbol?.trim() ?? "";
      const projTokenName = p?.tokenName?.trim() ?? "";
      const projectName = p?.projectName?.trim() || null;

      const dexRow = dexByMint.get(r.mint);
      const dexSymbol = dexRow?.baseToken?.symbol?.trim() ?? "";

      let imageUrl: string | null = null;
      if (p && !liquid) {
        imageUrl = normalizeImageUrl(p.tokenImageUrl ?? undefined);
      }
      if (!imageUrl) {
        imageUrl = normalizeImageUrl(dexRow?.info?.imageUrl);
      }

      let heliusSymbol = "";
      if (!dexSymbol || !imageUrl) {
        const helius = await fetchHeliusTokenMeta(r.mint).catch(() => null);
        heliusSymbol = helius?.symbol?.trim() ?? "";
        if (!imageUrl) imageUrl = normalizeImageUrl(helius?.image);
      }

      // Draw SPL `symbol` in Postgres is the project label — not the market ticker.
      let symbol = liquid
        ? dexSymbol || heliusSymbol || projTokenName || abbrevMint(r.mint)
        : projTokenName ||
          splLabel ||
          dexSymbol ||
          heliusSymbol ||
          abbrevMint(r.mint);
      if (symbol.length > 12) symbol = symbol.slice(0, 12);

      out[r.mint] = {
        mint: r.mint,
        symbol,
        name: symbol,
        projectName,
        imageUrl,
        liquid,
        projectXHandle: p?.projectXHandle ?? null,
      };
    }),
  );

  return out;
}
