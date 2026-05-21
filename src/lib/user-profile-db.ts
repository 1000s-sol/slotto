import type { Prisma, UserProfile } from "@prisma/client";

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
  discordProfileUrlFromId,
  isDiscordEmbedDefaultAvatar,
  normalizeXHandle,
  xAvatarFallback,
  xProfileUrl,
  type SocialProfile,
  type WalletSocialPublic,
} from "@/lib/social-profile-url";

export type ProfilePublic = {
  id: string;
  social: WalletSocialPublic;
  wallets: string[];
};

function discordProfileNeedsRepair(row: UserProfile): boolean {
  if (!row.discordId) return false;
  const hash = row.discordAvatarHash?.trim();
  const url = row.discordAvatarUrl?.trim();
  if (hash && url && !isDiscordEmbedDefaultAvatar(url)) return false;
  if (hash) return !url || isDiscordEmbedDefaultAvatar(url);
  return true;
}

export async function ensureDiscordProfileComplete(
  row: UserProfile,
): Promise<UserProfile> {
  if (!row.discordId || !discordProfileNeedsRepair(row)) {
    return row;
  }

  let hash =
    row.discordAvatarHash?.trim() ||
    discordAvatarHashFromUrl(row.discordAvatarUrl) ||
    null;

  if (!hash) {
    const bot = discordBotToken();
    if (!bot) return row;
    const user = await fetchDiscordUserByBot(row.discordId, bot);
    if (user?.avatar) hash = user.avatar.trim();
  }

  if (!hash) {
    return prisma.userProfile.update({
      where: { id: row.id },
      data: { discordAvatarUrl: null, discordAvatarHash: null },
    });
  }

  const avatarUrl = discordAvatarUrlFromHash(row.discordId, hash);
  return prisma.userProfile.update({
    where: { id: row.id },
    data: { discordAvatarHash: hash, discordAvatarUrl: avatarUrl },
  });
}

function discordProfileFromRow(row: UserProfile): SocialProfile | null {
  if (!row.discordId) return null;
  const username =
    row.discordDisplayName?.trim() ||
    row.discordUsername?.trim() ||
    "Discord user";
  return {
    username,
    avatarUrl: discordAvatarUrlForProfile(
      row.discordId,
      row.discordAvatarHash,
      row.discordAvatarUrl,
    ),
    profileUrl: discordProfileUrlFromId(row.discordId),
  };
}

function xProfileFromRow(row: UserProfile): SocialProfile | null {
  const handle = row.xHandle ? normalizeXHandle(row.xHandle) : null;
  if (!handle) return null;
  return {
    username: handle,
    avatarUrl: row.xAvatarUrl?.trim() || xAvatarFallback(handle),
    profileUrl: xProfileUrl(handle),
  };
}

export function socialFromUserProfile(row: UserProfile): WalletSocialPublic {
  return {
    discord: discordProfileFromRow(row),
    x: xProfileFromRow(row),
  };
}

export async function getProfilePublic(
  userProfileId: string,
): Promise<ProfilePublic | null> {
  const loaded = await prisma.userProfile.findUnique({
    where: { id: userProfileId },
    include: { linkedWallets: { orderBy: { verifiedAt: "desc" } } },
  });
  if (!loaded) return null;
  const profile = await ensureDiscordProfileComplete(loaded);
  return {
    id: profile.id,
    social: socialFromUserProfile(profile),
    wallets: loaded.linkedWallets.map((w) => w.wallet),
  };
}

export async function getSocialByWallets(
  wallets: string[],
): Promise<Record<string, WalletSocialPublic>> {
  const unique = [...new Set(wallets.filter(Boolean))].slice(0, 100);
  const out: Record<string, WalletSocialPublic> = {};
  for (const w of unique) {
    out[w] = { discord: null, x: null };
  }
  if (unique.length === 0) return out;

  const links = await prisma.linkedWallet.findMany({
    where: { wallet: { in: unique } },
    include: { userProfile: true },
  });

  const profileIds = [...new Set(links.map((l) => l.userProfileId))];
  const profiles = new Map<string, UserProfile>();
  for (const id of profileIds) {
    let row = await prisma.userProfile.findUnique({ where: { id } });
    if (row) {
      row = await ensureDiscordProfileComplete(row);
      profiles.set(id, row);
    }
  }

  for (const link of links) {
    const row = profiles.get(link.userProfileId);
    if (row) {
      out[link.wallet] = socialFromUserProfile(row);
    }
  }
  return out;
}

/** @deprecated alias */
export const getWalletSocialBatch = getSocialByWallets;

export async function createUserProfile(): Promise<UserProfile> {
  return prisma.userProfile.create({ data: {} });
}

export async function findProfileByDiscordId(
  discordId: string,
): Promise<UserProfile | null> {
  return prisma.userProfile.findUnique({ where: { discordId } });
}

export async function findProfileByXId(xId: string): Promise<UserProfile | null> {
  return prisma.userProfile.findUnique({ where: { xId } });
}

export async function mergeProfiles(
  targetId: string,
  sourceId: string,
): Promise<UserProfile> {
  if (targetId === sourceId) {
    return prisma.userProfile.findUniqueOrThrow({ where: { id: targetId } });
  }

  return prisma.$transaction(async (tx) => {
    const [target, source] = await Promise.all([
      tx.userProfile.findUniqueOrThrow({
        where: { id: targetId },
        include: { linkedWallets: true },
      }),
      tx.userProfile.findUniqueOrThrow({
        where: { id: sourceId },
        include: { linkedWallets: true, projectLikes: true },
      }),
    ]);

    const targetWalletSet = new Set(target.linkedWallets.map((w) => w.wallet));
    for (const lw of source.linkedWallets) {
      if (!targetWalletSet.has(lw.wallet)) {
        await tx.linkedWallet.update({
          where: { id: lw.id },
          data: { userProfileId: targetId },
        });
      } else {
        await tx.linkedWallet.delete({ where: { id: lw.id } });
      }
    }

    for (const like of source.projectLikes) {
      const dup = await tx.projectLike.findUnique({
        where: {
          projectId_userProfileId: {
            projectId: like.projectId,
            userProfileId: targetId,
          },
        },
      });
      if (dup) {
        await tx.projectLike.delete({ where: { id: like.id } });
      } else {
        await tx.projectLike.update({
          where: { id: like.id },
          data: { userProfileId: targetId },
        });
      }
    }

    const socialPatch: Prisma.UserProfileUpdateInput = {};
    if (!target.discordId && source.discordId) {
      socialPatch.discordId = source.discordId;
      socialPatch.discordUsername = source.discordUsername;
      socialPatch.discordDisplayName = source.discordDisplayName;
      socialPatch.discordAvatarUrl = source.discordAvatarUrl;
      socialPatch.discordAvatarHash = source.discordAvatarHash;
    }
    if (!target.xId && source.xId) {
      socialPatch.xId = source.xId;
      socialPatch.xHandle = source.xHandle;
      socialPatch.xAvatarUrl = source.xAvatarUrl;
    }

    if (Object.keys(socialPatch).length > 0) {
      await tx.userProfile.update({
        where: { id: targetId },
        data: socialPatch,
      });
    }

    await tx.userProfile.delete({ where: { id: sourceId } });

    return tx.userProfile.findUniqueOrThrow({
      where: { id: targetId },
      include: { linkedWallets: true },
    });
  });
}

export async function resolveProfileForOAuth(
  provider: "discord" | "x",
  providerUserId: string,
  sessionProfileId: string | null,
): Promise<string> {
  const existing =
    provider === "discord"
      ? await findProfileByDiscordId(providerUserId)
      : await findProfileByXId(providerUserId);

  if (existing) {
    if (sessionProfileId && sessionProfileId !== existing.id) {
      await mergeProfiles(sessionProfileId, existing.id);
      return sessionProfileId;
    }
    return existing.id;
  }

  if (sessionProfileId) {
    return sessionProfileId;
  }

  const created = await createUserProfile();
  return created.id;
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
): string | null {
  const hash = discordAvatarHashFromProfile(profile);
  if (hash) return discordAvatarUrlFromHash(discordId, hash);
  const image = profile.image?.trim();
  if (image && !isDiscordEmbedDefaultAvatar(image)) return image;
  return null;
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

export async function linkDiscordToProfile(
  userProfileId: string | null,
  profile: DiscordOAuthProfile,
): Promise<UserProfile> {
  const discordId = profile.id?.trim();
  if (!discordId) throw new Error("Discord profile missing id");

  const profileId = await resolveProfileForOAuth(
    "discord",
    discordId,
    userProfileId,
  );

  let avatarHash = discordAvatarHashFromProfile(profile);
  let avatar = discordAvatarFromOAuth(discordId, profile);

  if (!avatarHash) {
    const bot = discordBotToken();
    if (bot) {
      const user = await fetchDiscordUserByBot(discordId, bot);
      if (user?.avatar) {
        const fromApi = discordProfileFromApiUser(user);
        avatarHash = fromApi.avatar;
        avatar = fromApi.image;
      }
    }
  }

  if (!avatarHash || !avatar) {
    throw new Error(
      "Could not load your Discord profile picture. Add DISCORD_BOT_TOKEN on the server and try again.",
    );
  }

  return prisma.userProfile.update({
    where: { id: profileId },
    data: {
      discordId,
      discordUsername: profile.username ?? null,
      discordDisplayName: profile.global_name ?? profile.username ?? null,
      discordAvatarUrl: avatar,
      discordAvatarHash: avatarHash,
    },
  });
}

export async function linkTwitterToProfile(
  userProfileId: string | null,
  profile: TwitterOAuthProfile,
): Promise<UserProfile> {
  const xId = (profile.data?.id ?? profile.id)?.trim();
  const rawHandle = profile.data?.username ?? profile.username;
  const xHandle = rawHandle ? normalizeXHandle(rawHandle) : null;
  if (!xId) throw new Error("X profile missing id");
  if (!xHandle) throw new Error("X profile missing valid username");

  const profileId = await resolveProfileForOAuth("x", xId, userProfileId);

  const avatar =
    twitterAvatarFromProfile(profile) ?? xAvatarFallback(xHandle);

  return prisma.userProfile.update({
    where: { id: profileId },
    data: { xId, xHandle, xAvatarUrl: avatar },
  });
}

export async function linkWalletToProfile(
  userProfileId: string,
  wallet: string,
): Promise<{ profileId: string; merged: boolean }> {
  const existing = await prisma.linkedWallet.findUnique({
    where: { wallet },
    include: { userProfile: true },
  });

  if (existing) {
    if (existing.userProfileId === userProfileId) {
      await prisma.linkedWallet.update({
        where: { wallet },
        data: { verifiedAt: new Date() },
      });
      return { profileId: userProfileId, merged: false };
    }
    await mergeProfiles(userProfileId, existing.userProfileId);
    await prisma.linkedWallet.upsert({
      where: { wallet },
      create: { wallet, userProfileId, verifiedAt: new Date() },
      update: { userProfileId, verifiedAt: new Date() },
    });
    return { profileId: userProfileId, merged: true };
  }

  await prisma.linkedWallet.create({
    data: { wallet, userProfileId, verifiedAt: new Date() },
  });
  return { profileId: userProfileId, merged: false };
}

export async function unlinkWalletFromProfile(
  userProfileId: string,
  wallet: string,
): Promise<void> {
  await prisma.linkedWallet.deleteMany({
    where: { userProfileId, wallet },
  });
}

export async function unlinkDiscord(userProfileId: string): Promise<void> {
  await prisma.userProfile.update({
    where: { id: userProfileId },
    data: {
      discordId: null,
      discordUsername: null,
      discordDisplayName: null,
      discordAvatarUrl: null,
      discordAvatarHash: null,
    },
  });
}

export async function unlinkTwitter(userProfileId: string): Promise<void> {
  await prisma.userProfile.update({
    where: { id: userProfileId },
    data: { xId: null, xHandle: null, xAvatarUrl: null },
  });
}

export async function userHasLikedProject(
  userProfileId: string,
  projectId: string,
): Promise<boolean> {
  const row = await prisma.projectLike.findUnique({
    where: { projectId_userProfileId: { projectId, userProfileId } },
  });
  return !!row;
}
