import type { SplMintDraft } from "./spl-types";

/**
 * SLOTTO FREE ENTRY token: a fixed-supply SPL token (50) handed out as giveaway
 * prizes. 1 whole token = 1 free draw entry. It is auto-included on every draw
 * as a fixed-price SPL payment option (price = 1 token), so winners can redeem
 * a free ticket. When redeemed the token flows to the team vault (like any SPL
 * buy) and is re-distributed — a closed recycle loop.
 *
 * The mint address is read from NEXT_PUBLIC_FREE_ENTRY_MINT so the app ships
 * before the mainnet mint exists; until set, every consumer treats it as
 * "not configured" and silently no-ops.
 */
export const FREE_ENTRY_MINT = (
  process.env.NEXT_PUBLIC_FREE_ENTRY_MINT ?? ""
).trim();

/** 9 decimals so wallets render it as a fungible token (not an NFT-style collectible). */
export const FREE_ENTRY_DECIMALS = 9;

/** Base units per ticket: exactly one whole token (1 × 10^9). */
export const FREE_ENTRY_PRICE_PER_TICKET = "1000000000";

/** Fixed supply; also the per-draw ticket cap. */
export const FREE_ENTRY_CAP = 50;

export const FREE_ENTRY_NAME = "SLOTTO FREE ENTRY";

/** Short symbol shown in cost labels and on-chain metadata (≤10 chars). */
export const FREE_ENTRY_SYMBOL = "FREE";

/** Square art served from /public (also referenced by the off-chain metadata JSON). */
export const FREE_ENTRY_IMAGE_PATH = "/free-entry-token.png";

export function isFreeEntryMint(mint: string | null | undefined): boolean {
  return Boolean(FREE_ENTRY_MINT) && mint === FREE_ENTRY_MINT;
}

export function freeEntryConfigured(): boolean {
  return Boolean(FREE_ENTRY_MINT);
}

/** Permanent SPL row injected into every draw at create time. */
export function freeEntryDraft(): SplMintDraft {
  return {
    mint: FREE_ENTRY_MINT,
    symbol: FREE_ENTRY_SYMBOL,
    label: FREE_ENTRY_NAME,
    mintDecimals: FREE_ENTRY_DECIMALS,
    pricingMode: "fixed",
    priceUi: "1",
    pricePerTicket: FREE_ENTRY_PRICE_PER_TICKET,
    onChainCap: FREE_ENTRY_CAP,
    displayCap: FREE_ENTRY_CAP,
    published: true,
    purchasesLocked: false,
    enabled: true,
  };
}
