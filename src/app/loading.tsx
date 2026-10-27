export default function Loading() {
  return (
    <div className="page-enter space-y-6" aria-live="polite" aria-busy="true">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent-gold">Loading</p>
      <div className="h-10 w-2/3 max-w-md animate-pulse rounded-xl bg-white/10" />
      <div className="h-56 animate-pulse rounded-xl border border-white/10 bg-[#14398f]/70" />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="h-40 animate-pulse rounded-xl border border-white/10 bg-[#14398f]/50" />
        <div className="h-40 animate-pulse rounded-xl border border-white/10 bg-[#14398f]/50" />
      </div>
    </div>
  );
}
