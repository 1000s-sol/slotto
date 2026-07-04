import type { Metadata } from "next";

import { HomeDrawsSection } from "@/components/home-draws-section";
import { HomeLotterySection } from "@/components/home-lottery-section";

export const metadata: Metadata = {
  title: "Lottery preview",
  robots: { index: false, follow: false },
};

export default function PreviewLotteryPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-center text-sm text-amber-100">
        Internal test preview — Discord posts go to the test channel only; no X
        posts. Use this page for today&apos;s dry run (3–5pm ET).
      </div>
      <div className="rounded-2xl border border-border bg-bg-elevated/55 p-4 sm:p-8">
        <HomeLotterySection preview />
      </div>
      <HomeDrawsSection preview />
    </div>
  );
}
