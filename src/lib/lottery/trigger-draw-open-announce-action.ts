"use server";

import { runAnnounceDrawOpenIfNeeded } from "./announce-draw-open";

export type DrawOpenAnnounceUiResult = {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
};

/** Server action: post draw-live when sales open (homepage countdown hook). */
export async function triggerDrawOpenAnnounceAction(
  drawId: number,
): Promise<DrawOpenAnnounceUiResult> {
  if (!Number.isFinite(drawId) || drawId < 0) {
    return { ok: false, reason: "Invalid draw id" };
  }
  const result = await runAnnounceDrawOpenIfNeeded(drawId);
  return {
    ok: result.ok,
    skipped: result.skipped,
    reason: result.reason,
  };
}
