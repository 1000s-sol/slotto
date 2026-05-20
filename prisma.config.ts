import "dotenv/config";

import { defineConfig, env } from "prisma/config";

/** Neon sometimes appends `channel_binding=require`; Node often fails TLS with it. */
function normalizeDatabaseUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.searchParams.delete("channel_binding");
    return u.toString();
  } catch {
    return raw;
  }
}

/** Prefer unpooled/direct Neon URL for CLI (`db push`, migrate). Falls back to pooled `DATABASE_URL`. */
function cliDatabaseUrl(): string {
  const raw =
    process.env.DIRECT_URL?.trim() ||
    process.env.DIRECT_URL_UNPOOLED?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    env("DATABASE_URL");
  return normalizeDatabaseUrl(raw);
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: cliDatabaseUrl(),
  },
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
});
