import { BuyPreflightError } from "./preflight-buy-sol";

type BuyErrorContext = {
  /** "SOL" or SPL mint address */
  payWith?: "SOL" | string;
};

function errorStrings(error: unknown): string[] {
  const out: string[] = [];
  if (error == null) return out;

  if (typeof error === "string") {
    out.push(error);
    return out;
  }

  if (error instanceof Error) {
    out.push(error.message);
    const nested = (error as Error & { cause?: unknown }).cause;
    if (nested) out.push(...errorStrings(nested));
  }

  if (typeof error === "object") {
    const o = error as Record<string, unknown>;
    if (typeof o.message === "string") out.push(o.message);
    if (typeof o.msg === "string") out.push(o.msg);
    if (o.code === 429 || o.status === 429 || o.statusCode === 429) {
      out.push("429 Too Many Requests");
    }
    const headers = o.headers;
    if (headers && typeof headers === "object") {
      const h = headers as Record<string, unknown>;
      const retryAfter =
        h["retry-after"] ?? h["Retry-After"] ?? h.retryAfter;
      if (retryAfter != null) {
        out.push(`retry-after ${String(retryAfter)}`);
      }
    }
    if (Array.isArray(o.logs)) {
      for (const line of o.logs) {
        if (typeof line === "string") out.push(line);
      }
    }
    const inner = o.error;
    if (inner && typeof inner === "object") {
      const ie = inner as Record<string, unknown>;
      if (typeof ie.message === "string") out.push(ie.message);
      if (typeof ie.errorMessage === "string") out.push(ie.errorMessage);
    }
  }

  return out;
}

function combinedErrorText(error: unknown): string {
  return errorStrings(error).join("\n");
}

/** Full RPC / on-chain error text (nested logs, causes). Used for retry detection. */
export function lotteryRpcErrorText(error: unknown): string {
  return combinedErrorText(error);
}

function parseRetrySeconds(text: string): number | null {
  const patterns = [
    /try again in (\d+)\s*seconds?/i,
    /retry[- ]after[:\s]+(\d+)/i,
    /retry after (\d+)/i,
    /wait (\d+)\s*seconds?/i,
    /(\d+)\s*seconds?\s*(?:until|before)/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) {
      const n = parseInt(m[1], 10);
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  return null;
}

/** When RPC does not say how long to wait, use a conservative default. */
const RATE_LIMIT_DEFAULT_WAIT_SECONDS = 30;

function isRateLimited(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    /\b429\b/.test(lower) ||
    lower.includes("too many requests") ||
    lower.includes("rate limit") ||
    lower.includes("rate limited")
  );
}

function isWalletRejected(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes("user rejected") ||
    lower.includes("user denied") ||
    lower.includes("rejected the request") ||
    lower.includes("transaction cancelled") ||
    lower.includes("transaction canceled")
  );
}

function isWalletClusterMismatch(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes("attempt to debit an account but found no record") ||
    lower.includes("account not found") ||
    lower.includes("could not find account") ||
    (lower.includes("simulation failed") &&
      (lower.includes("accountnotfound") ||
        lower.includes("account not found") ||
        lower.includes("incorrect program id")))
  );
}

function isInsufficientSol(text: string): boolean {
  const lower = text.toLowerCase();
  if (
    lower.includes("insufficientfundsforrent") ||
    lower.includes("insufficient funds for rent")
  ) {
    return false;
  }
  return (
    lower.includes("insufficient lamports") ||
    lower.includes("insufficient funds for fee") ||
    lower.includes("insufficientfundsforfee") ||
    (lower.includes("insufficient funds") && !lower.includes("buyer_token")) ||
    (lower.includes("simulation failed") &&
      lower.includes("transfer") &&
      lower.includes("lamports"))
  );
}

function isInsufficientSplToken(text: string): boolean {
  const lower = text.toLowerCase();
  if (
    lower.includes("accountnotinitialized") &&
    (lower.includes("buyer_token") || lower.includes("buyer token"))
  ) {
    return true;
  }
  if (lower.includes("buyer_token") && lower.includes("3012")) {
    return true;
  }
  if (
    lower.includes("error number: 3012") &&
    lower.includes("accountnotinitialized")
  ) {
    return true;
  }
  if (
    lower.includes("insufficient funds") &&
    (lower.includes("token") || lower.includes("buyer_token"))
  ) {
    return true;
  }
  if (
    lower.includes("error code: insufficientfunds") &&
    lower.includes("token")
  ) {
    return true;
  }
  return false;
}

/** Map raw wallet / RPC / Anchor errors to short copy for the buy-tickets UI. */
export function formatLotteryBuyError(
  error: unknown,
  context: BuyErrorContext = {},
): string {
  if (error instanceof BuyPreflightError) {
    return error.message;
  }

  const text = combinedErrorText(error);
  if (!text.trim()) return "Purchase failed. Please try again.";

  if (isWalletRejected(text)) {
    return "Transaction cancelled in your wallet.";
  }

  if (
    text.toLowerCase().includes("no signers") ||
    text.toLowerCase().includes("no signer")
  ) {
    const detail = text.trim().slice(0, 120);
    return detail.length > 20
      ? `Wallet signing failed (${detail}). Hard refresh, reconnect Phantom on mainnet, then try again.`
      : "Wallet signing failed. Hard refresh, reconnect Phantom on mainnet, then try again.";
  }

  if (isRateLimited(text)) {
    const seconds =
      parseRetrySeconds(text) ?? RATE_LIMIT_DEFAULT_WAIT_SECONDS;
    return `Rate limit reached. Please wait ${seconds} second${seconds === 1 ? "" : "s"} and try again.`;
  }

  const payingSpl = context.payWith && context.payWith !== "SOL";

  if (isWalletClusterMismatch(text)) {
    return "Wallet network mismatch: switch Phantom to the same network Slotto uses (Mainnet Beta for production), then try again.";
  }

  if (payingSpl && isInsufficientSplToken(text)) {
    return "Insufficient token balance. Connect a wallet that holds this token, or buy the token first.";
  }

  if (isInsufficientSol(text) || (!payingSpl && isInsufficientSplToken(text))) {
    return (
      "Phantom rejected this purchase (often a false insufficient-SOL warning on ticket buys). " +
      "Confirm Phantom is on Mainnet Beta, refresh, and try again. Create-draw worked because " +
      "that tx shape differs from buy (one program call vs several SOL transfers)."
    );
  }

  if (
    text.includes("OutsideSalesWindow") ||
    text.toLowerCase().includes("outside sales window")
  ) {
    return "Ticket sales are not open yet (or have closed). Check the countdown on this page.";
  }

  if (
    text.includes("SplQuotedPriceTooLow") ||
    text.includes("SplQuotedPriceTooHigh") ||
    text.toLowerCase().includes("price is below the minimum band") ||
    text.toLowerCase().includes("price exceeds on-chain max")
  ) {
    return "Token price moved — refresh the page to get the latest ticket price, then try again.";
  }

  if (
    text.includes("TicketChunkNotInitialized") ||
    text.includes("ticket chunk not initialized")
  ) {
    return "Ticket sales are not ready yet for this draw. Please try again shortly.";
  }

  if (isInsufficientSplToken(text)) {
    return "Insufficient token balance for this purchase.";
  }

  if (text.length > 180) {
    return "Purchase failed. Please check your balance and try again.";
  }

  return text;
}

/** Admin on-chain actions (create draw, init, team ATA). */
export function formatLotteryAdminError(error: unknown): string {
  const text = combinedErrorText(error);
  if (
    text.includes("403") ||
    text.toLowerCase().includes("access forbidden")
  ) {
    return (
      "RPC 403 — Helius or Phantom blocked the call. Remove LOTTERY_RPC_URL if it contains helius on Vercel, redeploy, hard-refresh, retry. " +
      "Admin uses api.mainnet-beta.solana.com only."
    );
  }
  if (
    text.includes("ConstraintSeeds") ||
    text.includes("seeds constraint was violated") ||
    text.includes("Error Number: 2006")
  ) {
    return (
      "Draw account mismatch: the app used the wrong draw id for this cluster. " +
      "Hard-refresh the page, confirm “Next draw id” matches mainnet (should be 1 after draw #0 refunded), then create again."
    );
  }
  if (text.length > 200) {
    return `${text.slice(0, 200)}…`;
  }
  return text.trim() || "On-chain action failed.";
}

/** Crank / auto-settle errors shown on the homepage. */
export function formatLotterySettlementError(error: unknown): string {
  const text = combinedErrorText(error);
  if (text.includes("Unknown action")) {
    return "Settlement already completed or duplicate crank — refresh the page.";
  }
  if (
    text.includes("Public crank disabled") ||
    text.includes("server cron")
  ) {
    return "Draw settlement runs automatically every few minutes. Refresh the page shortly.";
  }
  if (
    text.includes("Keeper not configured") ||
    text.includes("LOTTERY_KEEPER_SECRET_KEY")
  ) {
    return "Auto-settlement is not configured on Vercel (set LOTTERY_KEEPER_SECRET_KEY). An admin can run: npm run lottery:settle -- <drawId>";
  }
  if (
    text.includes("invalid api key") ||
    text.includes("-32401") ||
    text.includes("401 Unauthorized")
  ) {
    return "Vercel RPC misconfigured: fix or remove HELIUS_API_KEY, set LOTTERY_CLUSTER=devnet, or set LOTTERY_RPC_URL to https://api.devnet.solana.com.";
  }
  if (isRateLimited(text)) {
    const seconds =
      parseRetrySeconds(text) ?? RATE_LIMIT_DEFAULT_WAIT_SECONDS;
    return `RPC rate limit — wait ${seconds}s and refresh.`;
  }
  if (text.length > 200) {
    return `${text.slice(0, 200)}…`;
  }
  return text.trim() || "Settlement failed. Try again or run lottery:settle locally.";
}
