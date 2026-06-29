/**
 * Default on-chain fee recipients (set at `initialize`).
 * Verify these pubkeys on the target cluster before `npm run lottery:init` on mainnet.
 */
export const LOTTERY_TEAM_VAULT = "416jfKtqp6e1MHhpXvXM8eWVHqpck17LKnJByv22fKpA";
export const LOTTERY_SETUP_VAULT = "8qYRRgqukZvS31h3roSaQrQgcrP1w2qG5uXPDnKV7tS7";
export const LOTTERY_BUX_VAULT = "3WNHW6sr1sQdbRjovhPrxgEJdWASZ43egGWMMNrhgoRR";
/** 1.5% of nominal SOL ticket price each (hardcoded in program). */
export const LOTTERY_PARTNER_VAULT_1 =
  "G4v8VgEe7GX5uCGHuky1YjcXwPVKtYhUG5CskUK3eipG";
export const LOTTERY_PARTNER_VAULT_2 =
  "9LLLZeUYGbHqPLj4R1SLLmV8GPFpAThXz7Cfv7d24tUN";
