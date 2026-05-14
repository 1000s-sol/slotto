import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";

import { prisma } from "@/lib/prisma";

export const ADMIN_COOKIE = "slotto_admin";

const SESSION_MAX_AGE_SEC = 7 * 24 * 60 * 60;
const CHALLENGE_MAX_AGE_SEC = 5 * 60;

function getSecret() {
  return process.env.ADMIN_DASHBOARD_SECRET?.trim() ?? "";
}

export function adminSecretConfigured(): boolean {
  return getSecret().length >= 16;
}

function hmac(payload: string): string {
  const secret = getSecret();
  if (!secret) throw new Error("ADMIN_DASHBOARD_SECRET is not set");
  return createHmac("sha256", secret).update(payload).digest("hex");
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

export type AdminSession = { address: string; exp: number };

export function buildAdminToken(address: string): string {
  const exp = Date.now() + SESSION_MAX_AGE_SEC * 1000;
  const payload = `${address}.${exp}`;
  const sig = hmac(payload);
  return `${payload}.${sig}`;
}

export function parseAdminToken(raw: string | undefined): AdminSession | null {
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

export async function readAdminCookie(): Promise<AdminSession | null> {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  return parseAdminToken(token);
}

export async function setAdminSessionCookie(token: string) {
  (await cookies()).set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SEC,
  });
}

export async function clearAdminSessionCookie() {
  (await cookies()).delete(ADMIN_COOKIE);
}

export async function isActiveAdminWallet(address: string): Promise<boolean> {
  if (!address) return false;
  try {
    const row = await prisma.adminWallet.findUnique({
      where: { address },
      select: { isActive: true },
    });
    return !!row?.isActive;
  } catch {
    return false;
  }
}

export async function currentAdminAddress(): Promise<string | null> {
  const session = await readAdminCookie();
  if (!session) return null;
  if (!(await isActiveAdminWallet(session.address))) return null;
  return session.address;
}

export type Challenge = { nonce: string; exp: number; sig: string };

export function buildChallenge(): Challenge {
  const nonce = randomBytes(24).toString("hex");
  const exp = Date.now() + CHALLENGE_MAX_AGE_SEC * 1000;
  const sig = hmac(`${nonce}.${exp}`);
  return { nonce, exp, sig };
}

export function verifyChallenge(nonce: string, exp: number, sig: string): boolean {
  if (!nonce || !sig || !Number.isFinite(exp)) return false;
  if (Date.now() > exp) return false;
  const expected = hmac(`${nonce}.${exp}`);
  return safeEq(sig, expected);
}

export function challengeMessage(address: string, c: Challenge): string {
  return [
    "Slotto admin sign-in",
    "",
    `Address: ${address}`,
    `Nonce: ${c.nonce}`,
    `Issued at: ${new Date(Date.now()).toISOString()}`,
    `Expires: ${new Date(c.exp).toISOString()}`,
  ].join("\n");
}

export function parseChallengeFromMessage(message: string): { nonce?: string; address?: string } {
  const out: { nonce?: string; address?: string } = {};
  for (const line of message.split("\n")) {
    const [k, ...rest] = line.split(":");
    if (!k) continue;
    const v = rest.join(":").trim();
    if (k.trim().toLowerCase() === "nonce") out.nonce = v;
    if (k.trim().toLowerCase() === "address") out.address = v;
  }
  return out;
}
