import type { WalletProfile } from "@prisma/client";

import {
  discordBotToken,
  discordProfileFromApiUser,
  fetchDiscordUserByBot,
} from "@/lib/discord-api";
import { prisma } from "@/lib/prisma";
import {
  discordAvatarHashFromUrl,
  discordAvatarUrlForProfile,
  discordAvatarUrlFromHash,
  discordDefaultAvatar,
  discordProfileUrlFromId,
  isDiscordEmbedDefaultAvatar,
  normalizeXHandle,
  xAvatarFallback,
  xProfileUrl,
  type SocialProfile,
  type WalletSocialPublic,
} from "@/lib/social-profile-url";

function discordProfileNeedsRepair(row: WalletProfile): boolean {
  if (!row.discordId) return false;
  const hash = row.discordAvatarHash?.trim();
  const url = row.discordAvatarUrl?.trim();
  if (hash && url && !isDiscordEmbedDefaultAvatar(url)) return false;
  if (hash) return !url || isDiscordEmbedDefaultAvatar(url);
  return true;
}

/** Backfill avatar hash/URL for existing links — no disconnect required. */
export async function ensureDiscordProfileComplete(
  row: WalletProfile,
): Promise<WalletProfile> {
  if (!row.discordId || !discordProfileNeedsRepair(row)) {
    return row;
  }

  let hash =
    row.discordAvatarHash?.trim() ||
    discordAvatarHashFromUrl(row.discordAvatarUrl) ||
    null;

  if (!hash) {
    const bot = discordBotToken();
    if (bot) {
      const user = await fetchDiscordUserByBot(row.discordId, bot);
      if (user?.avatar) {
        hash = user.avatar.trim();
      }
    }
  }

  if (!hash) {
    return row;
  }

  const avatarUrl = discordAvatarUrlFromHash(row.discordId, hash);
  return prisma.walletProfile.update({
    where: { wallet: row.wallet },
    data: {
      discordAvatarHash: hash,
      discordAvatarUrl: avatarUrl,
    },
  });
}

function discordProfileFromRow(row: {
  discordId: string | null;
  discordUsername: string | null;
  discordDisplayName: string | null;
  discordAvatarUrl: string | null;
  discordAvatarHash: string | null;
}): SocialProfile | null {
  if (!row.discordId) return null;
  const username =
    row.discordDisplayName?.trim() ||
    row.discordUsername?.trim() ||
    "Discord user";
  const avatarUrl = discordAvatarUrlForProfile(
    row.discordId,
    row.discordAvatarHash,
    row.discordAvatarUrl,
  );
  return {
    username,
    avatarUrl,
    profileUrl: discordProfileUrlFromId(row.discordId),
  };
}

function xProfileFromRow(row: {
  xHandle: string | null;
  xAvatarUrl: string | null;
}): SocialProfile | null {
  const handle = row.xHandle ? normalizeXHandle(row.xHandle) : null;
  if (!handle) return null;
  return {
    username: handle,
    avatarUrl: row.xAvatarUrl?.trim() || xAvatarFallback(handle),
    profileUrl: xProfileUrl(handle),
  };
}

export function walletSocialFromRow(row: {
  discordId: string | null;
  discordUsername: string | null;
  discordDisplayName: string | null;
  discordAvatarUrl: string | null;
  discordAvatarHash: string | null;
  xHandle: string | null;
  xAvatarUrl: string | null;
}): WalletSocialPublic {
  return {
    discord: discordProfileFromRow(row),
    x: xProfileFromRow(row),
  };
}

export async function getWalletSocial(
  wallet: string,
): Promise<WalletSocialPublic> {
  let row = await prisma.walletProfile.findUnique({ where: { wallet } });
  if (!row) return { discord: null, x: null };
  row = await ensureDiscordProfileComplete(row);
  return walletSocialFromRow(row);
}

export async function getWalletSocialBatch(
  wallets: string[],
): Promise<Record<string, WalletSocialPublic>> {
  const unique = [...new Set(wallets.filter(Boolean))].slice(0, 100);
  if (unique.length === 0) return {};
  const rows = await prisma.walletProfile.findMany({
    where: { wallet: { in: unique } },
  });
  const out: Record<string, WalletSocialPublic> = {};
  for (const w of unique) {
    out[w] = { discord: null, x: null };
  }
  for (const row of rows) {
    const fixed = await ensureDiscordProfileComplete(row);
    out[row.wallet] = walletSocialFromRow(fixed);
  }
  return out;
}

type DiscordOAuthProfile = {
  id?: string;
  username?: string | null;
  global_name?: string | null;
  image?: string | null;
  avatar?: string | null;
};

function discordAvatarHashFromProfile(
  profile: DiscordOAuthProfile,
): string | null {
  return (
    profile.avatar?.trim() ||
    discordAvatarHashFromUrl(profile.image) ||
    null
  );
}

function discordAvatarFromOAuth(
  discordId: string,
  profile: DiscordOAuthProfile,
): string {
  const hash = discordAvatarHashFromProfile(profile);
  if (hash) {
    return discordAvatarUrlFromHash(discordId, hash);
  }
  const image = profile.image?.trim();
  if (image && !isDiscordEmbedDefaultAvatar(image)) {
    return image;
  }
  if (image) return image;
  return discordDefaultAvatar(discordId);
}

type TwitterOAuthProfile = {
  data?: {
    id?: string;
    username?: string | null;
    profile_image_url?: string | null;
  };
  id?: string;
  username?: string | null;
  picture?: string | null;
  profile_image_url?: string | null;
};

function twitterAvatarFromProfile(profile: TwitterOAuthProfile): string | null {
  const raw =
    profile.data?.profile_image_url ??
    profile.profile_image_url ??
    profile.picture;
  if (!raw || typeof raw !== "string") return null;
  return raw.replace("_normal", "_400x400");
}

export async function linkDiscordToWallet(
  wallet: string,
  profile: DiscordOAuthProfile,
): Promise<void> {
  const discordId = profile.id?.trim();
  if (!discordId) throw new Error("Discord profile missing id");

  const existing = await prisma.walletProfile.findUnique({
    where: { discordId },
  });
  if (existing && existing.wallet !== wallet) {
    throw new Error("This Discord account is already linked to another wallet");
  }

  const avatarHash = discordAvatarHashFromProfile(profile);
  const avatar = discordAvatarFromOAuth(discordId, profile);

  await prisma.walletProfile.upsert({
    where: { wallet },
    create: {
      wallet,
      discordId,
      discordUsername: profile.username ?? null,
      discordDisplayName: profile.global_name ?? profile.username ?? null,
      discordAvatarUrl: avatar,
      discordAvatarHash: avatarHash,
    },
    update: {
      discordId,
      discordUsername: profile.username ?? null,
      discordDisplayName: profile.global_name ?? profile.username ?? null,
      discordAvatarUrl: avatar,
      discordAvatarHash: avatarHash,
    },
  });
}

export async function linkTwitterToWallet(
  wallet: string,
  profile: TwitterOAuthProfile,
): Promise<void> {
  const xId = (profile.data?.id ?? profile.id)?.trim();
  const rawHandle = profile.data?.username ?? profile.username;
  const xHandle = rawHandle ? normalizeXHandle(rawHandle) : null;
  if (!xId) throw new Error("X profile missing id");
  if (!xHandle) throw new Error("X profile missing valid username");

  const existing = await prisma.walletProfile.findUnique({
    where: { xId },
  });
  if (existing && existing.wallet !== wallet) {
    throw new Error("This X account is already linked to another wallet");
  }

  const avatar =
    twitterAvatarFromProfile(profile) ?? xAvatarFallback(xHandle);

  await prisma.walletProfile.upsert({
    where: { wallet },
    create: { wallet, xId, xHandle, xAvatarUrl: avatar },
    update: { xId, xHandle, xAvatarUrl: avatar },
  });
}

export async function unlinkDiscord(wallet: string): Promise<void> {
  await prisma.walletProfile.updateMany({
    where: { wallet },
    data: {
      discordId: null,
      discordUsername: null,
      discordDisplayName: null,
      discordAvatarUrl: null,
      discordAvatarHash: null,
    },
  });
}

export async function unlinkTwitter(wallet: string): Promise<void> {
  await prisma.walletProfile.updateMany({
    where: { wallet },
    data: { xId: null, xHandle: null, xAvatarUrl: null },
  });
}