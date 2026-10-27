import { createHmac, timingSafeEqual } from "node:crypto";

import { cookies, headers } from "next/headers";
import type { NextResponse } from "next/server";

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
  const all = (await cookies()).getAll(PROFILE_SESSION_COOKIE);
  for (const cookie of all) {
    const parsed = parseProfileSessionToken(cookie.value);
    if (parsed) return parsed.userProfileId;
  }
  return null;
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

function hostnameOf(value: string | null | undefined): string {
  const raw = (value ?? "").trim().toLowerCase();
  if (!raw) return "";
  try {
    if (raw.includes("://")) return new URL(raw).hostname;
  } catch {
    /* Host header, not a URL. */
  }
  return raw.split("/")[0]?.split(":")[0] ?? "";
}

/** Share the session across apex and www. Other hosts stay host-only. */
export function sessionCookieDomain(host?: string | null): string | undefined {
  if (process.env.NODE_ENV !== "production") return undefined;
  const hostname = hostnameOf(host);
  if (hostname === "slotto.gg" || hostname.endsWith(".slotto.gg")) return ".slotto.gg";
  return undefined;
}

function cookieOptions(host?: string | null) {
  const domain = sessionCookieDomain(host);
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE_SEC,
    ...(domain ? { domain } : {}),
  };
}

async function requestHost(): Promise<string | undefined> {
  try {
    const h = await headers();
    return h.get("x-forwarded-host") || h.get("host") || undefined;
  } catch {
    return undefined;
  }
}

export async function setProfileSessionCookie(userProfileId: string) {
  const token = buildProfileSessionToken(userProfileId);
  const host = await requestHost();
  (await cookies()).set(PROFILE_SESSION_COOKIE, token, cookieOptions(host));
}

/** Attach the session to a redirect. cookies().set() is dropped on NextResponse.redirect(). */
export function attachProfileSessionCookie(
  response: NextResponse,
  userProfileId: string,
  host?: string | null,
) {
  response.cookies.set(
    PROFILE_SESSION_COOKIE,
    buildProfileSessionToken(userProfileId),
    cookieOptions(host),
  );
  return response;
}

export async function clearProfileSessionCookie() {
  const host = await requestHost();
  const domain = sessionCookieDomain(host);
  const jar = await cookies();
  jar.delete(PROFILE_SESSION_COOKIE);
  if (domain) {
    jar.delete({ name: PROFILE_SESSION_COOKIE, path: "/", domain });
  }
}
