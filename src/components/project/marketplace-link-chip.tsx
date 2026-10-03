import { marketplaceLogo, type MarketplaceId } from "@/lib/marketplace-icons";

const chipClass =
  "inline-flex min-w-0 flex-1 items-center justify-center rounded-lg border border-border/60 bg-surface/35 px-1 py-1 transition hover:border-accent-purple/35 hover:bg-surface/55 sm:flex-none sm:justify-start sm:p-1.5";

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
        className="h-5 w-full max-w-full object-contain object-center sm:h-9 sm:w-auto sm:max-w-[10.5rem] sm:object-left"
        loading="lazy"
        decoding="async"
      />
    </a>
  );
}
