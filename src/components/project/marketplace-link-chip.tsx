import { marketplaceLogo, type MarketplaceId } from "@/lib/marketplace-icons";

/**
 * Mobile width is always 1/4 of the row (minus gaps) so 1–4 chips share the same
 * size; four still fit on one line. Logos fill the chip. Desktop keeps auto width.
 */
const chipClass =
  "inline-flex h-9 w-[calc((100%-0.75rem)/4)] shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-surface/35 p-px transition hover:border-accent-purple/35 hover:bg-surface/55 sm:h-auto sm:w-auto sm:max-w-[10.5rem] sm:justify-start sm:p-1";

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
