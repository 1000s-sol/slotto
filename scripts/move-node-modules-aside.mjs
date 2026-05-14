/**
 * Renames node_modules out of the way in one metadata operation (fast on APFS).
 * Use when `rm -rf node_modules` is too slow or hangs. Delete the trash folder later when idle.
 */
import { rename } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const nm = path.join(root, "node_modules");
const trash = path.join(root, `node_modules._trash_${Date.now()}`);

try {
  await rename(nm, trash);
  console.log("Moved node_modules →", path.basename(trash), "(delete that folder later when you have time.)");
} catch (e) {
  if (/** @type {NodeJS.ErrnoException} */ (e).code === "ENOENT") {
    console.log("No node_modules folder; continuing.");
  } else {
    throw e;
  }
}

/* Optional: remove a previous single backup if empty name collision — skip */
