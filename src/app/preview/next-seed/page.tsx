import type { Metadata } from "next";

import { HomeScreen } from "@/components/home-screen";

export const metadata: Metadata = {
  title: "Next month's predicted seed jackpot preview",
  robots: { index: false, follow: false },
};

/** Same homepage layout as a live draw, with fake stats — for seed jackpot UI review. */
export default function NextSeedPreviewPage() {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-center text-sm text-amber-100">
        Internal preview — homepage with a fake live draw. Look under Live jackpot and in
        the entrants header for next month&apos;s predicted seed jackpot (increases when
        SPL ticket sales pass 395).
      </div>
      <HomeScreen demo />
    </div>
  );
}
