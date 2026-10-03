import { marketplaceLogo, type MarketplaceId } from "@/lib/marketplace-icons";

/**
 * Mobile: each chip is exactly 1/4 of the row (minus gaps) — never stretch to
 * fill leftover space when a collection has fewer than four links.
 */
const chipClass =
  "inline-flex h-8 w-[calc((100%-0.75rem)/4)] max-w-[calc((100%-0.75rem)/4)] shrink-0 grow-0 basis-[calc((100%-0.75rem)/4)] items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-surface/35 p-0.5 transition hover:border-accent-purple/35 hover:bg-surface/55 sm:h-auto sm:w-auto sm:max-w-[10.5rem] sm:basis-auto sm:justify-start sm:p-1.5";

export function MarketplaceLogoLink({
  href,
  marketplace,
}: {
  href: string;
  marketplace: MarketplaceId;
}) {
  const src = marketplaceLogo(marketplace);
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={chipClass}
      title={href}
      aria-label={marketplace}
    >
      <img
        src={src}
        alt=""
        className="h-full w-full object-contain object-center sm:h-9 sm:w-auto sm:max-w-[10.5rem] sm:object-left"
        loading="lazy"
        decoding="async"
      />
    </a>
  );
}
