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

function isInsufficientSol(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes("insufficient lamports") ||
    lower.includes("insufficient funds for fee") ||
    lower.includes("insufficientfundsforfee") ||
    lower.includes("attempt to debit an account but found no record") ||
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
  const text = combinedErrorText(error);
  if (!text.trim()) return "Purchase failed. Please try again.";

  if (isWalletRejected(text)) {
    return "Transaction cancelled in your wallet.";
  }

  if (isRateLimited(text)) {
    const seconds =
      parseRetrySeconds(text) ?? RATE_LIMIT_DEFAULT_WAIT_SECONDS;
    return `Rate limit reached. Please wait ${seconds} second${seconds === 1 ? "" : "s"} and try again.`;
  }

  const payingSpl = context.payWith && context.payWith !== "SOL";

  if (payingSpl && isInsufficientSplToken(text)) {
    return "Insufficient token balance. Connect a wallet that holds this token, or buy the token first.";
  }

  if (isInsufficientSol(text) || (!payingSpl && isInsufficientSplToken(text))) {
    return "Insufficient SOL balance for this purchase (including network fees).";
  }

  if (isInsufficientSplToken(text)) {
    return "Insufficient token balance for this purchase.";
  }

  if (text.length > 180) {
    return "Purchase failed. Please check your balance and try again.";
  }

  return text;
}
