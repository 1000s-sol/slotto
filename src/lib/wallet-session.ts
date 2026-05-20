import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";

import {
  buildProfileWalletVerifyMessage,
  parseProfileWalletVerifyMessage,
  profileWalletMessageValid,
} from "@/lib/wallet-verify-message";

export const PROFILE_WALLET_COOKIE = "slotto_profile_wallet";

export {
  buildProfileWalletVerifyMessage,
  parseProfileWalletVerifyMessage,
  profileWalletMessageValid,
};

const SESSION_MAX_AGE_SEC = 24 * 60 * 60;

function getSecret(): string {
  const s =
    process.env.AUTH_SECRET?.trim() ||
    process.env.ADMIN_DASHBOARD_SECRET?.trim() ||
    "";
  if (s.length < 16) {
    throw new Error("AUTH_SECRET or ADMIN_DASHBOARD_SECRET (16+ chars) required");
  }
  return s;
}

function hmac(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("hex");
}

function safeEq(a: string, b: string): boolean {
  const aa = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (aa.length !== bb.length) return false;
  try {
    return timingSafeEqual(aa, bb);
  } catch {
    return false;
  }
}

export function buildProfileWalletToken(address: string): string {
  const exp = Date.now() + SESSION_MAX_AGE_SEC * 1000;
  const payload = `${address}.${exp}`;
  const sig = hmac(payload);
  return `${payload}.${sig}`;
}

export function parseProfileWalletToken(
  raw: string | undefined,
): { address: string; exp: number } | null {
  if (!raw) return null;
  const parts = raw.split(".");
  if (parts.length !== 3) return null;
  const [address, expStr, sig] = parts;
  if (!address || !expStr || !sig) return null;
  const expected = hmac(`${address}.${expStr}`);
  if (!safeEq(sig, expected)) return null;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || Date.now() > exp) return null;
  return { address, exp };
}

export async function readProfileWalletCookie(): Promise<string | null> {
  const token = (await cookies()).get(PROFILE_WALLET_COOKIE)?.value;
  const parsed = parseProfileWalletToken(token);
  return parsed?.address ?? null;
}

export async function setProfileWalletCookie(address: string) {
  const token = buildProfileWalletToken(address);
  (await cookies()).set(PROFILE_WALLET_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SEC,
  });
}

export async function clearProfileWalletCookie() {
  (await cookies()).delete(PROFILE_WALLET_COOKIE);
}
