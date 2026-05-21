import { XLogo } from "@/components/x-logo";
import type { SocialProfile } from "@/lib/social-profile-url";

function AvatarImg({
  src,
  alt,
  size,
}: {
  src: string;
  alt: string;
  size: number;
}) {
  const dim = `${size}px`;
  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className="shrink-0 rounded-full object-cover ring-1 ring-border"
      style={{ width: dim, height: dim }}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
    />
  );
}

export function SocialProfileCell({
  profile,
  platform,
  size = 28,
}: {
  profile: SocialProfile | null | undefined;
  platform?: "discord" | "x";
  size?: number;
}) {
  if (!profile) {
    return <span className="text-muted/40">—</span>;
  }

  const inner = (
    <>
      {profile.avatarUrl ? (
        <AvatarImg src={profile.avatarUrl} alt={profile.username} size={size} />
      ) : (
        <span
          className="inline-flex shrink-0 items-center justify-center rounded-full bg-surface text-[10px] font-bold text-muted ring-1 ring-border"
          style={{ width: size, height: size }}
        >
          {profile.username.slice(0, 1).toUpperCase()}
        </span>
      )}
      <span className="max-w-[140px] truncate font-medium text-foreground">
        {profile.username}
      </span>
      {platform === "x" ? (
        <XLogo className="h-3.5 w-3.5 shrink-0 text-muted" />
      ) : null}
    </>
  );

  if (profile.profileUrl) {
    return (
      <a
        href={profile.profileUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex max-w-full items-center gap-2 hover:opacity-90"
        title={profile.username}
      >
        {inner}
      </a>
    );
  }

  return (
    <span className="inline-flex max-w-full items-center gap-2" title={profile.username}>
      {inner}
    </span>
  );
}
