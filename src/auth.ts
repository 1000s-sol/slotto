import NextAuth from "next-auth";
import type { Provider } from "next-auth/providers";
import Discord from "next-auth/providers/discord";
import Twitter from "next-auth/providers/twitter";

import {
  discordProfileFromApiUser,
  fetchDiscordUserMe,
  type DiscordApiUser,
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

/** PKCE, state, and callback URL must be readable on both www and apex. */
function oauthCookieDomain(): string | undefined {
  if (process.env.NODE_ENV !== "production") return undefined;
  try {
    const host = new URL(process.env.AUTH_URL || "").hostname.toLowerCase();
    if (host === "slotto.gg" || host === "www.slotto.gg") return ".slotto.gg";
  } catch {
    /* Leave cookies host-only. */
  }
  return undefined;
}

function sharedOAuthCookies() {
  const domain = oauthCookieDomain();
  if (!domain) return undefined;
  const shared = { options: { domain } };
  return {
    callbackUrl: shared,
    pkceCodeVerifier: shared,
    state: shared,
    nonce: shared,
  };
}

async function callbackPage(): Promise<string> {
  try {
    const jar = await cookies();
    const cb =
      jar.get("__Secure-authjs.callback-url")?.value ||
      jar.get("authjs.callback-url")?.value;
    if (!cb) return "/profile";
    try {
      return decodeURIComponent(cb);
    } catch {
      return cb;
    }
  } catch {
    /* The profile page can show the error instead. */
  }
  return "/profile";
}

async function returnWithError(message: string): Promise<string> {
  const next = await callbackPage();
  try {
    const dest = next.startsWith("/")
      ? new URL(next, "https://slotto.gg")
      : new URL(next);
    dest.searchParams.set("error", message);
    if (next.startsWith("/")) return `${dest.pathname}${dest.search}`;
    return dest.toString();
  } catch {
    return `/profile?error=${encodeURIComponent(message)}`;
  }
}

async function handoffRedirect(profileId: string, provider: string): Promise<string> {
  const token = buildProfileHandoffToken(profileId);
  const next = await callbackPage();
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
        // Discord adds iss=https://discord.com/api on the callback (RFC 9207).
        // Auth.js otherwise expects https://authjs.dev and rejects the login.
        issuer: "https://discord.com/api",
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
  cookies: sharedOAuthCookies(),
  callbacks: {
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      try {
        const dest = new URL(url);
        const host = dest.hostname.toLowerCase();
        if (
          host === "slotto.gg" ||
          host === "www.slotto.gg" ||
          host === "localhost" ||
          host.endsWith(".vercel.app")
        ) {
          return url;
        }
      } catch {
        /* Fall through to the auth origin. */
      }
      return baseUrl;
    },
    async signIn({ account, profile }) {
      if (!account?.provider || !profile) {
        return await returnWithError("oauth_failed");
      }
      try {
        let sessionProfileId: string | null = null;
        try {
          sessionProfileId = await readProfileSessionCookie();
        } catch {
          sessionProfileId = null;
        }

        if (account.provider === "discord") {
          const raw = profile as Partial<DiscordApiUser>;
          let discordUser: DiscordApiUser | null =
            raw.id && raw.username
              ? {
                  id: String(raw.id),
                  username: raw.username,
                  global_name: raw.global_name ?? null,
                  avatar: raw.avatar ?? null,
                }
              : null;
          const token = account.access_token?.trim();
          if (token) {
            const fetched = await fetchDiscordUserMe(token);
            if (fetched?.id) discordUser = fetched;
          }
          if (!discordUser?.id) {
            return await returnWithError("discord_profile_failed");
          }
          const row = await linkDiscordToProfile(
            sessionProfileId,
            discordProfileFromApiUser(discordUser),
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
          return await returnWithError("unknown_provider");
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "link_failed";
        return await returnWithError(msg);
      }
    },
  },
  pages: {
    signIn: "/profile",
    error: "/profile",
  },
});
