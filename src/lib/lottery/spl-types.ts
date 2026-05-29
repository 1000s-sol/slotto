/** Max SPL mint rows per draw on-chain (must match program `SPL_MINT_MAX`). */
export const SPL_MINT_MAX_ON_CHAIN = 50;

export type SplPricingMode = "fixed" | "liquidDynamic";

export type SplMintDraft = {
  mint: string;
  symbol: string;
  label: string;
  mintDecimals: number;
  pricingMode: SplPricingMode;
  /** Human-readable price per ticket (UI); fixed mints only. */
  priceUi: string;
  /** Base units per ticket: fixed price, or max cap for liquid-dynamic. */
  pricePerTicket: string;
  onChainCap: number;
  displayCap: number;
  published: boolean;
  purchasesLocked: boolean;
  /** UI: include this mint on the new draw. */
  enabled: boolean;
};

export type SplMintUiRow = {
  mint: string;
  symbol: string;
  cap: number;
  sold: number;
  displayCap: number;
  pricePerTicket: string;
  decimals: number;
  pricingMode: number;
  published: boolean;
  purchasesLocked: boolean;
  buyable: boolean;
};
