/**
 * Set / inspect structured listing section fields directly in the DB.
 *
 * Usage:
 *   npx tsx scripts/set-project-sections.ts status
 *   npx tsx scripts/set-project-sections.ts show <slug>
 *   npx tsx scripts/set-project-sections.ts set <slug> --overview "..." --staking "..." --token "..." --holder "..." [--services "..."]
 *   npx tsx scripts/set-project-sections.ts set <slug> --json path/to/sections.json
 *   npx tsx scripts/set-project-sections.ts seed-omerta
 *
 * JSON shape:
 *   { "overview": "...", "staking": "...", "token": "...", "holderUtility": "...", "services": "..." }
 *
 * Requires DATABASE_URL or DIRECT_URL in .env
 */
import fs from "node:fs";
import path from "node:path";

import { createScriptPrismaClient } from "./script-prisma";
import { OMERTA_PREVIEW } from "../src/lib/project-preview/omerta-preview-data";
import { hasListingSections } from "../src/lib/project-listing-sections";

const FIELD_FLAGS = {
  overview: "sectionOverview",
  staking: "sectionStaking",
  token: "sectionToken",
  holder: "sectionHolderUtility",
  holderUtility: "sectionHolderUtility",
  services: "sectionServices",
} as const;

type DbField = (typeof FIELD_FLAGS)[keyof typeof FIELD_FLAGS];

async function ensureColumns(prisma: ReturnType<typeof createScriptPrismaClient>) {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "Project"
      ADD COLUMN IF NOT EXISTS "sectionOverview" TEXT,
      ADD COLUMN IF NOT EXISTS "sectionStaking" TEXT,
      ADD COLUMN IF NOT EXISTS "sectionToken" TEXT,
      ADD COLUMN IF NOT EXISTS "sectionHolderUtility" TEXT,
      ADD COLUMN IF NOT EXISTS "sectionServices" TEXT
  `);
}

function parseArgs(argv: string[]) {
  const [cmd, slugOrPath, ...rest] = argv;
  const flags: Record<string, string> = {};
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const val = rest[i + 1];
    if (!val || val.startsWith("--")) {
      flags[key] = "true";
    } else {
      flags[key] = val;
      i++;
    }
  }
  return { cmd, slugOrPath, flags };
}

function sectionsFromJson(filePath: string): Partial<Record<DbField, string>> {
  const abs = path.resolve(filePath);
  const raw = JSON.parse(fs.readFileSync(abs, "utf8")) as Record<string, unknown>;
  const out: Partial<Record<DbField, string>> = {};
  const map: Record<string, DbField> = {
    overview: "sectionOverview",
    staking: "sectionStaking",
    token: "sectionToken",
    holder: "sectionHolderUtility",
    holderUtility: "sectionHolderUtility",
    services: "sectionServices",
  };
  for (const [k, db] of Object.entries(map)) {
    const v = raw[k];
    if (typeof v === "string" && v.trim()) out[db] = v.trim();
  }
  return out;
}

function sectionsFromFlags(flags: Record<string, string>): Partial<Record<DbField, string>> {
  const out: Partial<Record<DbField, string>> = {};
  for (const [flag, db] of Object.entries(FIELD_FLAGS)) {
    if (flags[flag]?.trim()) out[db] = flags[flag].trim();
  }
  return out;
}

async function main() {
  const { cmd, slugOrPath, flags } = parseArgs(process.argv.slice(2));
  if (!cmd || cmd === "help" || cmd === "-h" || cmd === "--help") {
    console.log(`Commands:
  status
  show <slug>
  set <slug> --overview "..." --staking "..." --token "..." --holder "..." [--services "..."]
  set <slug> --json ./sections.json
  seed-omerta`);
    process.exit(0);
  }

  const prisma = createScriptPrismaClient();
  try {
    await ensureColumns(prisma);

    if (cmd === "status") {
      const rows = await prisma.project.findMany({
        where: { published: true },
        select: {
          slug: true,
          name: true,
          sectionOverview: true,
          sectionStaking: true,
          sectionToken: true,
          sectionHolderUtility: true,
          sectionServices: true,
        },
        orderBy: { name: "asc" },
      });
      let done = 0;
      for (const r of rows) {
        const ok = hasListingSections(r);
        if (ok) done++;
        const mark = ok ? "[x]" : "[ ]";
        const svc = r.sectionServices?.trim() ? "+services" : "";
        console.log(`${mark} ${r.slug}  ${r.name}${svc ? `  (${svc})` : ""}`);
      }
      console.log(`\n${done}/${rows.length} reformatted (core four tiles filled).`);
      return;
    }

    if (cmd === "show") {
      if (!slugOrPath) throw new Error("Usage: show <slug>");
      const row = await prisma.project.findUnique({ where: { slug: slugOrPath } });
      if (!row) throw new Error(`No project with slug ${slugOrPath}`);
      console.log(
        JSON.stringify(
          {
            slug: row.slug,
            name: row.name,
            reformatted: hasListingSections(row),
            sectionOverview: row.sectionOverview,
            sectionStaking: row.sectionStaking,
            sectionToken: row.sectionToken,
            sectionHolderUtility: row.sectionHolderUtility,
            sectionServices: row.sectionServices,
          },
          null,
          2,
        ),
      );
      return;
    }

    if (cmd === "seed-omerta") {
      const data: Partial<Record<DbField, string>> = {};
      for (const s of OMERTA_PREVIEW.sections) {
        if (s.id === "overview") data.sectionOverview = s.body;
        if (s.id === "staking") data.sectionStaking = s.body;
        if (s.id === "token") data.sectionToken = s.body;
        if (s.id === "holderUtility") data.sectionHolderUtility = s.body;
        if (s.id === "services") data.sectionServices = s.body;
      }
      const updated = await prisma.project.update({
        where: { slug: "omerta-empire-city" },
        data,
      });
      console.log(`Seeded sections for ${updated.slug} (${updated.name}).`);
      return;
    }

    if (cmd === "set") {
      if (!slugOrPath) throw new Error("Usage: set <slug> ...");
      const data = flags.json
        ? sectionsFromJson(flags.json)
        : sectionsFromFlags(flags);
      if (Object.keys(data).length === 0) {
        throw new Error("Provide --json or at least one of --overview --staking --token --holder [--services]");
      }
      const updated = await prisma.project.update({
        where: { slug: slugOrPath },
        data,
      });
      console.log(`Updated ${updated.slug}. Fields: ${Object.keys(data).join(", ")}`);
      console.log(`Reformatted: ${hasListingSections({ ...updated, ...data })}`);
      return;
    }

    throw new Error(`Unknown command: ${cmd}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
