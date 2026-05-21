import type { SelectHTMLAttributes } from "react";

/** Shared dark-theme select — styled via `.site-select` in globals.css */
export const SITE_SELECT_CLASS =
  "site-select w-full cursor-pointer rounded-xl border border-border bg-surface/80 px-3 py-2.5 pr-9 text-sm font-medium text-foreground shadow-inner shadow-black/10 outline-none transition hover:border-accent-purple/30 focus:border-accent-purple/50 focus:ring-4 focus:ring-accent-purple/15 disabled:cursor-not-allowed disabled:opacity-50";

export function SiteSelect({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={[SITE_SELECT_CLASS, className].filter(Boolean).join(" ")} {...props}>
      {children}
    </select>
  );
}
