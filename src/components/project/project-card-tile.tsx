import Link from "next/link";

import { ProjectLikePill } from "@/components/project/project-detail-actions";

type TileProps = {
  slug: string;
  name: string;
  likes: number;
  imageUrl: string | null;
};

export function ProjectCardTile({ slug, name, likes, imageUrl }: TileProps) {
  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-bg-elevated/80 shadow-sm transition hover:border-accent-purple/35 hover:shadow-md">
      <div className="relative aspect-square w-full bg-surface/50">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-muted">No image</div>
        )}
        <Link href={`/projects/${slug}`} className="absolute inset-0 z-10" aria-label={`Open ${name}`} />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-bg-deep/80 via-transparent to-transparent opacity-90" />
        <div className="absolute right-2 top-2 z-20 sm:right-3 sm:top-3">
          <ProjectLikePill slug={slug} initialLikes={likes} variant="compact" />
        </div>
      </div>
      <div className="relative z-30 border-t border-border/60 bg-bg-elevated/95 px-3 py-3">
        <Link
          href={`/projects/${slug}`}
          className="line-clamp-2 text-sm font-semibold leading-snug text-foreground transition hover:text-accent-cyan"
        >
          {name}
        </Link>
      </div>
    </div>
  );
}
