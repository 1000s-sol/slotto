import { NextResponse } from "next/server";

import { readProfileSessionCookie } from "@/lib/profile-session";
import { getProfilePublic } from "@/lib/user-profile-db";

export const dynamic = "force-dynamic";

export async function GET() {
  const profileId = await readProfileSessionCookie();
  if (!profileId) {
    return NextResponse.json({ loggedIn: false, profile: null });
  }
  const profile = await getProfilePublic(profileId);
  if (!profile) {
    return NextResponse.json({ loggedIn: false, profile: null });
  }
  return NextResponse.json({ loggedIn: true, profile });
}
