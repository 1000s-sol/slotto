import "dotenv/config";

import { PrismaClient } from "@prisma/client";

/** Prefer unpooled Neon URL for one-off CLI scripts (pooler often times out locally). */
export function scriptDatabaseUrl(): string {
  const direct = process.env.DIRECT_URL?.trim();
  const pooled = process.env.DATABASE_URL?.trim();
  const url = direct || pooled;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. For local admin scripts, add Neon DIRECT_URL to .env (Neon dashboard → Connection → Direct).",
    );
  }
  return url;
}

export function createScriptPrismaClient(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: scriptDatabaseUrl() } },
  });
}
