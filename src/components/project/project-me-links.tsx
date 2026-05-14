import { MARKETPLACE_ICON } from "@/lib/marketplace-icons";
import { parseMagicEdenCollectionSymbol } from "@/lib/magiceden-stats";

function meLabel(url: string) {
  return parseMagicEdenCollectionSymbol(url) ?? "Collection";
}

export function ProjectMeLinks({ urls }: { urls: string[] }) {
  if (urls.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-1 gap-y-1 text-xs">
      {urls.map((url, i) => (
        <span key={`${url}-${i}`} className="inline-flex items-center gap-1">
          {i > 0 ? <span className="select-none px-0.5 text-[10px] text-muted/35">|</span> : null}
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex max-w-[min(100%,14rem)] items-center gap-1.5 rounded-full border border-border/60 bg-surface/35 px-2 py-1 text-muted backdrop-blur-sm transition hover:border-accent-purple/35 hover:text-foreground"
            title={url}
          >
            <img
              src={MARKETPLACE_ICON.magicEden}
              alt=""
              className="h-4 w-4 shrink-0 rounded object-contain"
              loading="lazy"
              decoding="async"
            />
            <span className="truncate font-medium">{meLabel(url)}</span>
            {i === 0 ? (
              <span className="shrink-0 rounded bg-accent-purple/20 px-1 py-0 text-[9px] uppercase tracking-wide text-accent-purple">
                Primary
              </span>
            ) : null}
          </a>
        </span>
      ))}
    </div>
  );
}
