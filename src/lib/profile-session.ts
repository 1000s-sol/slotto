import { createHmac, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";

export const PROFILE_SESSION_COOKIE = "slotto_user_profile";

const SESSION_MAX_AGE_SEC = 30 * 24 * 60 * 60;

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

export function buildProfileSessionToken(userProfileId: string): string {
  const exp = Date.now() + SESSION_MAX_AGE_SEC * 1000;
  const payload = `${userProfileId}.${exp}`;
  const sig = hmac(payload);
  return `${payload}.${sig}`;
}

export function parseProfileSessionToken(
  raw: string | undefined,
): { userProfileId: string; exp: number } | null {
  if (!raw) return null;
  const parts = raw.split(".");
  if (parts.length !== 3) return null;
  const [userProfileId, expStr, sig] = parts;
  if (!userProfileId || !expStr || !sig) return null;
  const expected = hmac(`${userProfileId}.${expStr}`);
  if (!safeEq(sig, expected)) return null;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || Date.now() > exp) return null;
  return { userProfileId, exp };
}

export async function readProfileSessionCookie(): Promise<string | null> {
  const token = (await cookies()).get(PROFILE_SESSION_COOKIE)?.value;
  const parsed = parseProfileSessionToken(token);
  return parsed?.userProfileId ?? null;
}

/** Short-lived token so the OAuth callback can hand the profile id to a route that sets the cookie. */
export function buildProfileHandoffToken(userProfileId: string): string {
  const exp = Date.now() + 2 * 60 * 1000;
  const payload = `h:${userProfileId}.${exp}`;
  const sig = hmac(payload);
  return `${payload}.${sig}`;
}

export function parseProfileHandoffToken(raw: string | undefined): string | null {
  if (!raw) return null;
  const parts = raw.split(".");
  if (parts.length !== 3) return null;
  const [markedId, expStr, sig] = parts;
  if (!markedId?.startsWith("h:") || !expStr || !sig) return null;
  const expected = hmac(`${markedId}.${expStr}`);
  if (!safeEq(sig, expected)) return null;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || Date.now() > exp) return null;
  return markedId.slice(2);
}

function sessionCookieDomain(): string | undefined {
  if (process.env.NODE_ENV !== "production") return undefined;
  const host = (
    process.env.AUTH_URL ||
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    ""
  ).toLowerCase();
  if (host.includes("slotto.gg")) return ".slotto.gg";
  return undefined;
}

export async function setProfileSessionCookie(userProfileId: string) {
  const token = buildProfileSessionToken(userProfileId);
  (await cookies()).set(PROFILE_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SEC,
    domain: sessionCookieDomain(),
  });
}

export async function clearProfileSessionCookie() {
  (await cookies()).delete(PROFILE_SESSION_COOKIE);
}
