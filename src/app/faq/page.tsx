import type { Metadata } from "next";

import { FaqContent } from "@/components/faq/faq-content";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Frequently asked questions about Slotto, the monthly on-chain lotto, SOL and SPL tickets, jackpots, and project listings.",
};

export default function FaqPage() {
  return <FaqContent />;
}
