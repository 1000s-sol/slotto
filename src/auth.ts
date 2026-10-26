import NextAuth from "next-auth";
import type { Provider } from "next-auth/providers";
import Discord from "next-auth/providers/discord";
import Twitter from "next-auth/providers/twitter";

import {
  discordProfileFromApiUser,
  fetchDiscordUserMe,
} from "@/lib/discord-api";
import { cookies } from "next/headers";

import {
  buildProfileHandoffToken,
  readProfileSessionCookie,
} from "@/lib/profile-session";
import { ensureAuthUrlEnv } from "@/lib/auth-url";
import {
  linkDiscordToProfile,
  linkTwitterToProfile,
} from "@/lib/user-profile-db";

ensureAuthUrlEnv();

async function handoffRedirect(profileId: string, provider: string): Promise<string> {
  const token = buildProfileHandoffToken(profileId);
  let next = "/profile";
  try {
    const jar = await cookies();
    const cb =
      jar.get("__Secure-authjs.callback-url")?.value ||
      jar.get("authjs.callback-url")?.value;
    if (cb) next = cb;
  } catch {
    /* Returning to the page that started OAuth is optional. */
  }
  const params = new URLSearchParams({ token, next, linked: provider });
  return `/api/profile/session/establish?${params.toString()}`;
}

function authSecret(): string | undefined {
  const s =
    process.env.AUTH_SECRET?.trim() ||
    process.env.ADMIN_DASHBOARD_SECRET?.trim();
  return s && s.length >= 16 ? s : undefined;
}

function providers(): Provider[] {
  const list: Provider[] = [];
  const discordId = process.env.AUTH_DISCORD_ID?.trim();
  const discordSecret = process.env.AUTH_DISCORD_SECRET?.trim();
  if (discordId && discordSecret) {
    list.push(
      Discord({
        clientId: discordId,
        clientSecret: discordSecret,
        profile(profile) {
          const p = profile as {
            id: string;
            username: string;
            discriminator: string;
            global_name: string | null;
            avatar: string | null;
            email: string | null;
          };
          let image: string;
          if (p.avatar === null) {
            const defaultAvatarNumber =
              p.discriminator === "0"
                ? Number(BigInt(p.id) >> BigInt(22)) % 6
                : parseInt(p.discriminator, 10) % 5;
            image = `https://cdn.discordapp.com/embed/avatars/${defaultAvatarNumber}.png`;
          } else {
            const format = p.avatar.startsWith("a_") ? "gif" : "png";
            image = `https://cdn.discordapp.com/avatars/${p.id}/${p.avatar}.${format}?size=256`;
          }
          return {
            id: p.id,
            name: p.global_name ?? p.username,
            email: p.email,
            image,
            avatar: p.avatar,
          };
        },
      }),
    );
  }
  const twitterId = process.env.AUTH_TWITTER_ID?.trim();
  const twitterSecret = process.env.AUTH_TWITTER_SECRET?.trim();
  if (twitterId && twitterSecret) {
    list.push(
      Twitter({
        clientId: twitterId,
        clientSecret: twitterSecret,
      }),
    );
  }
  return list;
}

export const { handlers, signIn } = NextAuth({
  trustHost: true,
  secret: authSecret(),
  providers: providers(),
  callbacks: {
    async signIn({ account, profile }) {
      if (!account?.provider || !profile) {
        return "/profile?error=oauth_failed";
      }
      try {
        const sessionProfileId = await readProfileSessionCookie();

        if (account.provider === "discord") {
          const token = account.access_token?.trim();
          if (!token) {
            return "/profile?error=discord_token_missing";
          }
          const user = await fetchDiscordUserMe(token);
          if (!user?.id) {
            return "/profile?error=discord_profile_failed";
          }
          const row = await linkDiscordToProfile(
            sessionProfileId,
            discordProfileFromApiUser(user),
          );
          return await handoffRedirect(row.id, account.provider);
        } else if (account.provider === "twitter") {
          const row = await linkTwitterToProfile(
            sessionProfileId,
            profile as {
              data?: { id?: string; username?: string | null };
              id?: string;
              username?: string | null;
              profile_image_url?: string | null;
              picture?: string | null;
            },
          );
          return await handoffRedirect(row.id, account.provider);
        } else {
          return "/profile?error=unknown_provider";
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "link_failed";
        return `/profile?error=${encodeURIComponent(msg)}`;
      }
    },
  },
  pages: {
    signIn: "/profile",
    error: "/profile",
  },
});
