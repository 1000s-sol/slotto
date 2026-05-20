import {
  discordAvatarUrlFromHash,
  discordDefaultAvatar,
} from "@/lib/social-profile-url";

export type DiscordApiUser = {
  id: string;
  username: string;
  global_name: string | null;
  avatar: string | null;
};

export async function fetchDiscordUserMe(
  accessToken: string,
): Promise<DiscordApiUser | null> {
  const res = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  return (await res.json()) as DiscordApiUser;
}

export async function fetchDiscordUserByBot(
  discordId: string,
  botToken: string,
): Promise<DiscordApiUser | null> {
  const res = await fetch(`https://discord.com/api/users/${discordId}`, {
    headers: { Authorization: `Bot ${botToken}` },
  });
  if (!res.ok) return null;
  return (await res.json()) as DiscordApiUser;
}

export function discordProfileFromApiUser(user: DiscordApiUser): {
  id: string;
  username: string;
  global_name: string | null;
  avatar: string | null;
  image: string;
} {
  const image = user.avatar
    ? discordAvatarUrlFromHash(user.id, user.avatar)
    : discordDefaultAvatar(user.id);
  return {
    id: user.id,
    username: user.username,
    global_name: user.global_name,
    avatar: user.avatar,
    image,
  };
}

export function discordBotToken(): string | undefined {
  return (
    process.env.DISCORD_BOT_TOKEN?.trim() ||
    process.env.AUTH_DISCORD_BOT_TOKEN?.trim()
  );
}
