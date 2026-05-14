"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useTransition } from "react";

const SORT_OPTIONS = [
  { value: "likes", label: "Likes" },
  { value: "name", label: "A–Z" },
  { value: "floor", label: "Floor price" },
] as const;

export type ProjectsSortValue = (typeof SORT_OPTIONS)[number]["value"];

export function ProjectsToolbar({ defaultSort }: { defaultSort: ProjectsSortValue }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const q = searchParams.get("q")?.trim() ?? "";

  const currentSort = useMemo(() => {
    const s = searchParams.get("sort")?.trim();
    if (s === "name" || s === "floor") return s;
    return defaultSort;
  }, [searchParams, defaultSort]);

  const apply = useCallback(
    (next: { sort?: ProjectsSortValue; q?: string }) => {
      const params = new URLSearchParams();
      const nextQ = next.q !== undefined ? next.q.trim() : q;
      if (nextQ) params.set("q", nextQ);
      const nextSort = next.sort ?? currentSort;
      if (nextSort !== "likes") params.set("sort", nextSort);
      const qs = params.toString();
      startTransition(() => {
        router.push(qs ? `/projects?${qs}` : "/projects");
      });
    },
    [router, q, currentSort],
  );

  return (
    <div className="flex w-full flex-col gap-3 sm:ml-auto sm:w-auto sm:flex-row sm:items-end sm:justify-end sm:gap-4">
      <label className="flex min-w-[10rem] flex-col gap-1 text-xs text-muted sm:min-w-[11rem]">
        Sort by
        <select
          value={currentSort}
          disabled={pending}
          onChange={(e) => {
            const sort = e.target.value as ProjectsSortValue;
            apply({ sort });
          }}
          className="rounded-xl border border-border bg-surface/60 px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent-purple/40 focus:ring-4 focus:ring-accent-purple/15 disabled:opacity-50"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <form
        className="flex w-full flex-col gap-2 text-xs text-muted sm:w-72"
        action="/projects"
        method="get"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const nextQ = String(fd.get("q") ?? "");
          apply({ q: nextQ, sort: currentSort });
        }}
      >
        <label htmlFor="q">Search</label>
        <input
          key={q}
          id="q"
          name="q"
          defaultValue={q}
          placeholder="Search by project name"
          className="rounded-xl border border-border bg-surface/60 px-3 py-2 text-sm text-foreground outline-none ring-accent-purple/0 transition focus:border-accent-purple/40 focus:ring-4 focus:ring-accent-purple/15"
        />
      </form>
    </div>
  );
}
