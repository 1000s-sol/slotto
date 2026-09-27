export type ProjectListingSectionId =
  | "overview"
  | "staking"
  | "token"
  | "holderUtility"
  | "services";

export type ProjectListingSection = {
  id: ProjectListingSectionId;
  label: string;
  body: string;
};

export type ProjectListingSectionFields = {
  sectionOverview?: string | null;
  sectionStaking?: string | null;
  sectionToken?: string | null;
  sectionHolderUtility?: string | null;
  sectionServices?: string | null;
};

const SECTION_META: {
  id: ProjectListingSectionId;
  label: string;
  field: keyof ProjectListingSectionFields;
}[] = [
  { id: "overview", label: "Overview", field: "sectionOverview" },
  { id: "staking", label: "Rewards / staking", field: "sectionStaking" },
  { id: "token", label: "Token", field: "sectionToken" },
  {
    id: "holderUtility",
    label: "Holder utility",
    field: "sectionHolderUtility",
  },
  { id: "services", label: "Services", field: "sectionServices" },
];

export function trimSection(value: string | null | undefined): string {
  return (value ?? "").trim();
}

/** True when the four core tiles are filled (services optional). */
export function hasListingSections(p: ProjectListingSectionFields): boolean {
  return Boolean(
    trimSection(p.sectionOverview) &&
      trimSection(p.sectionStaking) &&
      trimSection(p.sectionToken) &&
      trimSection(p.sectionHolderUtility),
  );
}

/** Non-empty tiles in fixed order (services omitted when blank). */
export function listingSectionsFromProject(
  p: ProjectListingSectionFields,
): ProjectListingSection[] {
  const out: ProjectListingSection[] = [];
  for (const meta of SECTION_META) {
    const body = trimSection(p[meta.field]);
    if (!body) continue;
    out.push({ id: meta.id, label: meta.label, body });
  }
  return out;
}

export function listingShareBlurb(
  p: ProjectListingSectionFields & { reviewMd?: string | null },
): string {
  const overview = trimSection(p.sectionOverview);
  if (overview) return overview;
  return (p.reviewMd ?? "").trim();
}
