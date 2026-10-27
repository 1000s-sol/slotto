import type { Metadata } from "next";

import { HomeScreen } from "@/components/home-screen";

export const metadata: Metadata = {
  title: "UI preview",
  robots: { index: false, follow: false },
};

export default function DesignPreviewPage() {
  return <HomeScreen />;
}
