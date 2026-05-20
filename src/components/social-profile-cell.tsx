import type { SocialProfile } from "@/lib/social-profile-url";

function XLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

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
      referrerPolicy={
        src.includes("discordapp.com") || src.includes("discord.com")
          ? "strict-origin-when-cross-origin"
          : "no-referrer"
      }
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
