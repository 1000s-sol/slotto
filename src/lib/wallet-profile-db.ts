import { prisma } from "@/lib/prisma";
import {
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
  const row = await prisma.walletProfile.findUnique({ where: { wallet } });
  if (!row) return { discord: null, x: null };
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
    out[row.wallet] = walletSocialFromRow(row);
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

function discordAvatarFromOAuth(
  discordId: string,
  profile: DiscordOAuthProfile,
): string {
  const hash = profile.avatar?.trim();
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

  const avatarHash = profile.avatar?.trim() || null;
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