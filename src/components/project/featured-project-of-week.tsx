import Link from "next/link";

import { ProjectLikePill } from "@/components/project/project-detail-actions";
import { excerptFromReviewMd } from "@/lib/project-excerpt";

type Props = {
  slug: string;
  name: string;
  likes: number;
  reviewMd: string;
  imageUrl: string | null;
};

export function FeaturedProjectOfWeek({ slug, name, likes, reviewMd, imageUrl }: Props) {
  const excerpt = excerptFromReviewMd(reviewMd, 360);

  return (
    <section aria-labelledby="featured-project-heading" className="space-y-2">
      <p id="featured-project-heading" className="text-[11px] font-medium uppercase tracking-[0.2em] text-accent-gold/90">
        Featured this week
      </p>
      <div className="overflow-hidden rounded-2xl border-2 border-accent-gold/55 bg-bg-elevated/85 shadow-lg shadow-accent-gold/10">
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-stretch sm:gap-6 sm:p-6">
          <div className="relative mx-auto w-full max-w-[min(100%,20rem)] shrink-0 sm:mx-0 sm:w-44 md:w-52">
            <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-border bg-surface/50">
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="eager"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm text-muted">No image</div>
              )}
              <Link href={`/projects/${slug}`} className="absolute inset-0 z-10" aria-label={`Open ${name}`} />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-bg-deep/70 via-transparent to-transparent" />
              <div className="absolute right-2 top-2 z-20 sm:right-3 sm:top-3">
                <ProjectLikePill slug={slug} initialLikes={likes} />
              </div>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              <Link href={`/projects/${slug}`} className="hover:text-accent-cyan">
                {name}
              </Link>
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted sm:text-[15px]">{excerpt}</p>
            <div className="mt-4">
              <Link
                href={`/projects/${slug}`}
                className="inline-flex text-sm font-medium text-accent-cyan hover:underline"
              >
                View project →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
