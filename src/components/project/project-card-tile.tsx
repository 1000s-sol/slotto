import Link from "next/link";

import { DiscordLogo } from "@/components/discord-logo";
import { ProjectLikePill } from "@/components/project/project-detail-actions";
import { XLogo } from "@/components/x-logo";
import { formatSocialCount } from "@/lib/project-social-stats";

type TileProps = {
  slug: string;
  name: string;
  likes: number;
  imageUrl: string | null;
  discordMembers?: number | null;
  twitterFollowers?: number | null;
};

export function ProjectCardTile({
  slug,
  name,
  likes,
  imageUrl,
  discordMembers = null,
  twitterFollowers = null,
}: TileProps) {
  const discordCount = formatSocialCount(discordMembers);
  const twitterCount = formatSocialCount(twitterFollowers);
  const hasSocial = !!discordCount || !!twitterCount;

  return (
    <div className="group flex min-w-0 max-w-full flex-col overflow-hidden rounded-2xl border border-border bg-bg-elevated/80 shadow-sm transition hover:border-accent-purple/35 hover:shadow-md">
      <div className="relative aspect-square w-full max-w-full overflow-hidden bg-surface/50">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            className="h-full w-full max-w-full object-cover transition duration-300 group-hover:scale-[1.02]"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-muted">No image</div>
        )}
        <Link href={`/projects/${slug}`} className="absolute inset-0 z-10" aria-label={`Open ${name}`} />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-bg-deep/80 via-transparent to-transparent opacity-90" />
        <div className="absolute right-1.5 top-1.5 z-20 sm:right-2 sm:top-2">
          <ProjectLikePill slug={slug} initialLikes={likes} variant="compact" />
        </div>
      </div>
      <div className="relative z-30 flex min-w-0 flex-col gap-1.5 border-t border-border/60 bg-bg-elevated/95 px-2 py-2 sm:px-3 sm:py-2.5">
        <Link
          href={`/projects/${slug}`}
          className="line-clamp-2 text-xs font-semibold leading-snug text-foreground transition hover:text-accent-cyan sm:text-sm"
        >
          {name}
        </Link>
        {hasSocial ? (
          <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 text-[10px] tabular-nums text-muted sm:text-[11px]">
            {discordCount ? (
              <span
                className="inline-flex items-center gap-1"
                title={`${discordCount} Discord members`}
              >
                <DiscordLogo size={12} className="shrink-0" />
                <span className="font-semibold text-foreground/90">{discordCount}</span>
              </span>
            ) : null}
            {twitterCount ? (
              <span
                className="inline-flex items-center gap-1"
                title={`${twitterCount} X followers`}
              >
                <XLogo size={11} className="shrink-0 text-foreground" />
                <span className="font-semibold text-foreground/90">{twitterCount}</span>
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
