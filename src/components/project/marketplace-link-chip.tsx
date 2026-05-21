import { marketplaceLogo, type MarketplaceId } from "@/lib/marketplace-icons";

const chipClass =
  "inline-flex shrink-0 items-center rounded-lg border border-border/60 bg-surface/35 p-1 transition hover:border-accent-purple/35 hover:bg-surface/55";

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
        className="h-8 w-auto max-w-[9.5rem] object-contain object-left sm:h-9 sm:max-w-[10.5rem]"
        loading="lazy"
        decoding="async"
      />
    </a>
  );
}
