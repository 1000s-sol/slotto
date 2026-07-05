/**
 * Backfill public draw labels: on-chain #9 → public #1, dry-runs → TEST-*.
 * Usage: npm run lottery:seed-draw-meta
 */
import "dotenv/config";

import { seedDefaultDrawDisplayMeta } from "../src/lib/lottery/draw-display-db";

async function main() {
  await seedDefaultDrawDisplayMeta();
  console.info(
    "Done: draw #9 → public #1 (PRODUCTION); draws 0–8, 10, 11 → TEST (hidden from past winners).",
  );
  console.info(
    "Next PRODUCTION draw (LOTTERY_TEST_MODE=false) auto-registers as public #2.",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
