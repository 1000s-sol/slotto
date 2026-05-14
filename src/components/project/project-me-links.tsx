import { parseMagicEdenCollectionSymbol } from "@/lib/magiceden-stats";

function meLabel(url: string) {
  return parseMagicEdenCollectionSymbol(url) ?? "Collection";
}

export function ProjectMeLinks({ urls }: { urls: string[] }) {
  if (urls.length === 0) return null;

  return (
    <div className="mt-3">
      <p className="text-[11px] uppercase tracking-wide text-muted/80">Magic Eden</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-1 gap-y-1 text-xs">
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
              <MagicEdenMark className="h-4 w-4 shrink-0" />
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
    </div>
  );
}

function MagicEdenMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="6" fill="#E42575" />
      <path
        fill="#fff"
        d="M8 12.5 16 7l8 5.5V20l-8 5-8-5v-7.5Zm2.2 1.3V18.2L16 22l5.8-3.8v-4.4L16 10l-5.8 3.8Z"
      />
    </svg>
  );
}
