import { marketplaceIconForHref } from "@/lib/marketplace-icons";

const chipClass =
  "inline-flex max-w-[min(100%,18rem)] items-center gap-1.5 rounded-full border border-border/60 bg-surface/35 px-2.5 py-1 text-xs text-muted backdrop-blur-sm transition hover:border-accent-purple/35 hover:text-foreground";

export function MarketplaceLinkChip({ href, label }: { href: string; label: string }) {
  const iconSrc = marketplaceIconForHref(href);
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={chipClass}
      title={href}
    >
      {iconSrc ? (
        <img
          src={iconSrc}
          alt=""
          className="h-4 w-4 shrink-0 rounded object-contain"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <GenericLinkGlyph className="h-4 w-4 shrink-0 text-muted" />
      )}
      <span className="truncate font-medium">{label}</span>
    </a>
  );
}

function GenericLinkGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <path d="M10 13a5 5 0 0 1 0-7l1-1a5 5 0 0 1 7 7l-1 1M14 11a5 5 0 0 1 0 7l-1 1a5 5 0 0 1-7-7l1-1" strokeLinecap="round" />
    </svg>
  );
}
