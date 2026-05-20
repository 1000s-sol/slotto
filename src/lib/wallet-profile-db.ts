import { prisma } from "@/lib/prisma";
import {
  discordDisplayLabel,
  normalizeDiscord,
  normalizeXHandle,
  type WalletSocialPublic,
} from "@/lib/social-profile-url";

export function walletSocialFromRow(row: {
  discordId: string | null;
  discordUsername: string | null;
  discordDisplayName: string | null;
  xHandle: string | null;
}): WalletSocialPublic {
  const discordRaw =
    row.discordDisplayName ||
    row.discordUsername ||
    (row.discordId ? row.discordId : null);
  const discord = discordRaw
    ? discordDisplayLabel(normalizeDiscord(discordRaw) ?? discordRaw)
    : null;
  const xHandle = row.xHandle ? normalizeXHandle(row.xHandle) : null;
  return { discord, xHandle };
}

export async function getWalletSocial(
  wallet: string,
): Promise<WalletSocialPublic> {
  const row = await prisma.walletProfile.findUnique({ where: { wallet } });
  if (!row) return { discord: null, xHandle: null };
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
    out[w] = { discord: null, xHandle: null };
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
};

type TwitterOAuthProfile = {
  data?: { id?: string; username?: string | null; name?: string | null };
  id?: string;
  username?: string | null;
};

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

  await prisma.walletProfile.upsert({
    where: { wallet },
    create: {
      wallet,
      discordId,
      discordUsername: profile.username ?? null,
      discordDisplayName: profile.global_name ?? profile.username ?? null,
    },
    update: {
      discordId,
      discordUsername: profile.username ?? null,
      discordDisplayName: profile.global_name ?? profile.username ?? null,
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

  await prisma.walletProfile.upsert({
    where: { wallet },
    create: { wallet, xId, xHandle },
    update: { xId, xHandle },
  });
}

export async function unlinkDiscord(wallet: string): Promise<void> {
  await prisma.walletProfile.updateMany({
    where: { wallet },
    data: {
      discordId: null,
      discordUsername: null,
      discordDisplayName: null,
    },
  });
}

export async function unlinkTwitter(wallet: string): Promise<void> {
  await prisma.walletProfile.updateMany({
    where: { wallet },
    data: { xId: null, xHandle: null },
  });
}
