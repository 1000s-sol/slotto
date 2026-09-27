import type { Metadata } from "next";

import { BuybackPageClient } from "@/components/buyback/buyback-page-client";

export const metadata: Metadata = {
  title: "Buyback",
  description:
    "Slotto founder buyback: SPL ticket sale profits returned to projects via token buybacks at 90% of market value.",
};

export default function BuybackPage() {
  return <BuybackPageClient />;
}
