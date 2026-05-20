import { SocialProfileCell } from "@/components/social-profile-cell";
import type { SocialProfile } from "@/lib/social-profile-url";

/** @deprecated Use SocialProfileCell with SocialProfile */
export function DiscordProfileTag({
  discord,
}: {
  discord: string | SocialProfile;
}) {
  const profile =
    typeof discord === "string"
      ? {
          username: discord.replace(/^@/, ""),
          avatarUrl: null,
          profileUrl: null,
        }
      : discord;
  return <SocialProfileCell profile={profile} platform="discord" size={24} />;
}

/** @deprecated Use SocialProfileCell with SocialProfile */
export function XProfileTag({
  handle,
}: {
  handle: string | SocialProfile;
}) {
  const profile =
    typeof handle === "string"
      ? {
          username: handle.replace(/^@/, ""),
          avatarUrl: null,
          profileUrl: `https://x.com/${handle.replace(/^@/, "")}`,
        }
      : handle;
  return <SocialProfileCell profile={profile} platform="x" size={24} />;
}
