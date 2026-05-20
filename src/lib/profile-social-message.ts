const MAX_AGE_MS = 5 * 60 * 1000;

export function buildProfileSocialMessage(
  wallet: string,
  discord: string,
  xHandle: string,
): string {
  const issued = new Date();
  const expires = new Date(issued.getTime() + MAX_AGE_MS);
  return [
    "Slotto link social profile",
    "",
    `Wallet: ${wallet}`,
    `Discord: ${discord || "—"}`,
    `X: ${xHandle || "—"}`,
    `Issued at: ${issued.toISOString()}`,
    `Expires: ${expires.toISOString()}`,
  ].join("\n");
}

export function parseProfileSocialMessage(message: string): {
  wallet?: string;
  discord?: string;
  x?: string;
  expires?: number;
} {
  const out: {
    wallet?: string;
    discord?: string;
    x?: string;
    expires?: number;
  } = {};
  for (const line of message.split("\n")) {
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const val = line.slice(idx + 1).trim();
    if (key === "wallet") out.wallet = val;
    if (key === "discord") out.discord = val === "—" ? "" : val;
    if (key === "x") out.x = val === "—" ? "" : val;
    if (key === "expires") out.expires = Date.parse(val);
  }
  return out;
}

export function profileSocialMessageValid(expires: number | undefined): boolean {
  if (!expires || !Number.isFinite(expires)) return false;
  return Date.now() <= expires;
}
