const VERIFY_MAX_AGE_MS = 5 * 60 * 1000;

export function buildProfileWalletVerifyMessage(wallet: string): string {
  const issued = new Date();
  const expires = new Date(issued.getTime() + VERIFY_MAX_AGE_MS);
  return [
    "Slotto profile wallet verification",
    "",
    `Wallet: ${wallet}`,
    `Issued at: ${issued.toISOString()}`,
    `Expires: ${expires.toISOString()}`,
  ].join("\n");
}

export function parseProfileWalletVerifyMessage(message: string): {
  wallet?: string;
  expires?: number;
} {
  const out: { wallet?: string; expires?: number } = {};
  for (const line of message.split("\n")) {
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const val = line.slice(idx + 1).trim();
    if (key === "wallet") out.wallet = val;
    if (key === "expires") out.expires = Date.parse(val);
  }
  return out;
}

export function profileWalletMessageValid(expires: number | undefined): boolean {
  if (!expires || !Number.isFinite(expires)) return false;
  return Date.now() <= expires;
}
