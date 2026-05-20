import NextAuth from "next-auth";
import Discord from "next-auth/providers/discord";
import Twitter from "next-auth/providers/twitter";

import {
  linkDiscordToWallet,
  linkTwitterToWallet,
} from "@/lib/wallet-profile-db";
import { readProfileWalletCookie } from "@/lib/wallet-session";

export const { handlers, signIn } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  providers: [
    Discord({
      clientId: process.env.AUTH_DISCORD_ID,
      clientSecret: process.env.AUTH_DISCORD_SECRET,
    }),
    Twitter({
      clientId: process.env.AUTH_TWITTER_ID,
      clientSecret: process.env.AUTH_TWITTER_SECRET,
    }),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      const wallet = await readProfileWalletCookie();
      if (!wallet) {
        return "/profile?error=wallet_required";
      }
      if (!account?.provider || !profile) {
        return "/profile?error=oauth_failed";
      }
      try {
        if (account.provider === "discord") {
          await linkDiscordToWallet(
            wallet,
            profile as {
              id?: string;
              username?: string | null;
              global_name?: string | null;
            },
          );
        } else if (account.provider === "twitter") {
          await linkTwitterToWallet(
            wallet,
            profile as {
              data?: { id?: string; username?: string | null };
              id?: string;
              username?: string | null;
            },
          );
        } else {
          return "/profile?error=unknown_provider";
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "link_failed";
        return `/profile?error=${encodeURIComponent(msg)}`;
      }
      return `/profile?linked=${account.provider}`;
    },
  },
  pages: {
    signIn: "/profile",
    error: "/profile",
  },
});
