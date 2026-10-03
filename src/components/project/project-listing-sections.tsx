import type { ReactNode } from "react";

import type {
  ProjectListingSection,
  ProjectListingSectionId,
} from "@/lib/project-listing-sections";

const SECTION_THEME: Record<
  ProjectListingSectionId,
  { icon: string; border: string; chip: string }
> = {
  overview: {
    icon: "text-accent-cyan",
    border: "border-accent-cyan/35",
    chip: "border-accent-cyan/30 bg-accent-cyan/10",
  },
  staking: {
    icon: "text-accent-gold",
    border: "border-accent-gold/35",
    chip: "border-accent-gold/30 bg-accent-gold/10",
  },
  token: {
    icon: "text-accent-blue",
    border: "border-accent-blue/35",
    chip: "border-accent-blue/30 bg-accent-blue/10",
  },
  holderUtility: {
    icon: "text-accent-purple",
    border: "border-accent-purple/35",
    chip: "border-accent-purple/30 bg-accent-purple/10",
  },
  services: {
    icon: "text-accent-green",
    border: "border-accent-green/35",
    chip: "border-accent-green/30 bg-accent-green/10",
  },
};

function SectionIcon({
  id,
  className,
}: {
  id: ProjectListingSectionId;
  className: string;
}) {
  const common = {
    className: `h-5 w-5 shrink-0 ${className}`,
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

function isFullWidthTile(
  section: ProjectListingSection,
  sections: ProjectListingSection[],
): boolean {
  if (section.id === "overview") return true;
  const rest = sections.filter((s) => s.id !== "overview");
  if (rest.length === 0) return false;
  // Odd count of half-tiles leaves a lone last cell — span full width.
  if (rest.length % 2 === 1 && section.id === rest[rest.length - 1]!.id) {
    return true;
  }
  return false;
}

export function ProjectListingSections({
  sections,
}: {
  sections: ProjectListingSection[];
}) {
  if (sections.length === 0) return null;

  return (
    <div className="grid min-w-0 max-w-full grid-cols-1 gap-4 sm:grid-cols-2">
      {sections.map((section) => {
        const theme = SECTION_THEME[section.id];
        const fullWidth = isFullWidthTile(section, sections);
        return (
          <section
            key={section.id}
            className={[
              "min-w-0 max-w-full space-y-3 overflow-hidden rounded-xl border bg-bg-deep/40 p-4",
              theme.border,
              fullWidth ? "sm:col-span-2" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${theme.chip}`}
              >
                <SectionIcon id={section.id} className={theme.icon} />
              </span>
              <h2 className="min-w-0 text-base font-semibold text-foreground">
                {section.label}
              </h2>
            </div>
            <p className="break-words text-sm leading-relaxed text-muted">{section.body}</p>
          </section>
        );
      })}
    </div>
  );
}
