import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Lets the profile UI explain missing OAuth env before signIn() throws. */
export async function GET() {
  const secret =
    process.env.AUTH_SECRET?.trim() ||
    process.env.ADMIN_DASHBOARD_SECRET?.trim();
  return NextResponse.json({
    authSecret: Boolean(secret && secret.length >= 16),
    discord: Boolean(
      process.env.AUTH_DISCORD_ID?.trim() &&
        process.env.AUTH_DISCORD_SECRET?.trim(),
    ),
    twitter: Boolean(
      process.env.AUTH_TWITTER_ID?.trim() &&
        process.env.AUTH_TWITTER_SECRET?.trim(),
    ),
  });
}
