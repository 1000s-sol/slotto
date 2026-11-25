import type { Metadata } from "next";

import { NextSeedPreviewClient } from "./next-seed-preview-client";

export const metadata: Metadata = {
  title: "Next seed preview",
  robots: { index: false, follow: false },
};

export default function NextSeedPreviewPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-center text-sm text-amber-100">
        Internal preview — fake draw stats only. No wallet / chain. Tweak the sliders to
        see predicted next-seed growth after 395 SPL tickets.
      </div>
      <NextSeedPreviewClient />
    </div>
  );
}
