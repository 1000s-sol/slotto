/** Max SPL mint rows per draw on-chain (must match program `SPL_MINT_MAX`). */
export const SPL_MINT_MAX_ON_CHAIN = 50;

export type SplMintDraft = {
  mint: string;
  symbol: string;
  label: string;
  mintDecimals: number;
  /** Human-readable price per ticket (UI); stored as base units string in DB. */
  priceUi: string;
  pricePerTicket: string;
  onChainCap: number;
  displayCap: number;
  published: boolean;
  purchasesLocked: boolean;
};

export type SplMintUiRow = {
  mint: string;
  symbol: string;
  cap: number;
  sold: number;
  displayCap: number;
  pricePerTicket: string;
  decimals: number;
  published: boolean;
  purchasesLocked: boolean;
  buyable: boolean;
};
