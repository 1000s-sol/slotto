function birdeyeTokenUrl(mint: string) {
  return `https://birdeye.so/solana/token/${mint}`;
}

function solscanTokenUrl(mint: string) {
  return `https://solscan.io/token/${mint}`;
}

function abbrevMint(mint: string) {
  return `${mint.slice(0, 4)}…${mint.slice(-4)}`;
}

export function ProjectTokenBlock({
  mint,
  symbol,
  logoUrl,
  liquid = true,
}: {
  mint: string;
  symbol: string;
  logoUrl: string | null;
  liquid?: boolean;
}) {
  const thumbCls =
    "h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-border sm:h-10 sm:w-10";

  const thumb = logoUrl ? (
    <img
      src={logoUrl}
      alt=""
      className={thumbCls}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
    />
  ) : (
    <span
      className={`flex ${thumbCls} items-center justify-center bg-surface text-xs font-bold text-muted`}
      aria-hidden
    >
      {(symbol || "?").replace(/[^A-Za-z0-9]/g, "").slice(0, 1).toUpperCase() || "?"}
    </span>
  );

  const href = liquid ? birdeyeTokenUrl(mint) : solscanTokenUrl(mint);
  return (
    <div className="rounded-xl border border-border bg-surface/40 p-4 text-sm">
      <div className="text-xs uppercase tracking-wide text-muted">Project token</div>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 flex items-center gap-3 transition hover:opacity-90"
      >
        {thumb}
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-foreground">{symbol || abbrevMint(mint)}</div>
          {!liquid ? (
            <p className="mt-1 text-xs text-muted">Non-tradeable project token</p>
          ) : null}
          <div className="mt-0.5 break-all font-mono text-[11px] text-muted">{mint}</div>
        </div>
      </a>
    </div>
  );
}
