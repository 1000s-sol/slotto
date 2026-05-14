/**
 * npm renames packages to hidden dirs like `.agentkeepalive-<random>` during install.
 * If that path already exists, the next `npm install` fails with ENOTEMPTY. Remove those leftovers.
 *
 * Deletes in parallel batches (sequential rm per dir is far too slow on large trees).
 */
import { readdir, rm } from "node:fs/promises";
import path from "node:path";

const nm = path.join(process.cwd(), "node_modules");
let entries;
try {
  entries = await readdir(nm, { withFileTypes: true });
} catch (e) {
  if (/** @type {NodeJS.ErrnoException} */ (e).code === "ENOENT") process.exit(0);
  throw e;
}

/** e.g. `.agentkeepalive-vEpPVAni` — not `.bin`, not `@scope` */
const re = /^\.[^@/]+-[A-Za-z0-9_-]+$/;

const toRemove = entries.filter((ent) => ent.isDirectory() && ent.name !== ".bin" && re.test(ent.name)).map((e) => e.name);

const batchSize = 40;
for (let i = 0; i < toRemove.length; i += batchSize) {
  const slice = toRemove.slice(i, i + batchSize);
  await Promise.all(slice.map((name) => rm(path.join(nm, name), { recursive: true, force: true })));
  for (const name of slice) console.log("removed", name);
}

if (toRemove.length) console.log(`removed ${toRemove.length} npm temp dir(s) under node_modules`);
