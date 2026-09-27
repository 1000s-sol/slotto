import type { ReactNode } from "react";

import type {
  ProjectListingSection,
  ProjectListingSectionId,
} from "@/lib/project-listing-sections";

function SectionIcon({ id }: { id: ProjectListingSectionId }) {
  const common = {
    className: "h-5 w-5 shrink-0 text-accent-gold",
    viewBox: "0 0 24 24",
    fill: "none" as const,
    stroke: "currentColor",
    strokeWidth: 1.75,
    "aria-hidden": true as const,
  };

  let paths: ReactNode;
  switch (id) {
    case "overview":
      paths = (
        <>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 19.5V6.75A2.25 2.25 0 016.25 4.5h11.5A2.25 2.25 0 0120 6.75v12.75"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8 8.5h8M8 12h8M8 15.5h5"
          />
        </>
      );
      break;
    case "staking":
      paths = (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 3v18M7 8.5c0-1.8 2.2-3 5-3s5 1.2 5 3-2.2 3-5 3-5 1.2-5 3 2.2 3 5 3 5-1.2 5-3"
        />
      );
      break;
    case "token":
      paths = (
        <>
          <circle cx="12" cy="12" r="8.25" />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 7.5v9M9.5 9.75h3.75a1.75 1.75 0 010 3.5H9.5"
          />
        </>
      );
      break;
    case "holderUtility":
      paths = (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M14.25 7.5a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zM5.25 19.5a4.5 4.5 0 019 0M17.25 11.25l1.5 1.5 3-3"
        />
      );
      break;
    case "services":
      paths = (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M11.42 15.17l-4.66 2.33a.75.75 0 01-1.03-.9l1.2-4.02a.75.75 0 00-.2-.75L3.5 9.35a.75.75 0 01.44-1.3l4.2-.3a.75.75 0 00.6-.45l1.55-3.85a.75.75 0 011.36 0l1.55 3.85a.75.75 0 00.6.45l4.2.3a.75.75 0 01.44 1.3l-3.23 2.48a.75.75 0 00-.2.75l1.2 4.02a.75.75 0 01-1.03.9l-4.66-2.33a.75.75 0 00-.72 0z"
        />
      );
      break;
    default:
      paths = null;
  }

  return <svg {...common}>{paths}</svg>;
}

export function ProjectListingSections({
  sections,
}: {
  sections: ProjectListingSection[];
}) {
  if (sections.length === 0) return null;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {sections.map((section) => (
        <section
          key={section.id}
          className={
            section.id === "overview"
              ? "space-y-3 rounded-xl border border-border bg-bg-deep/40 p-4 sm:col-span-2"
              : "space-y-3 rounded-xl border border-border bg-bg-deep/40 p-4"
          }
        >
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface/50">
              <SectionIcon id={section.id} />
            </span>
            <h2 className="text-base font-semibold text-foreground">
              {section.label}
            </h2>
          </div>
          <p className="text-sm leading-relaxed text-muted">{section.body}</p>
        </section>
      ))}
    </div>
  );
}
