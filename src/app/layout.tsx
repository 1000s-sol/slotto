import type { Metadata } from "next";
import { headers } from "next/headers";
import localFont from "next/font/local";
import { Alfa_Slab_One, Geist, Geist_Mono, Rowdies } from "next/font/google";
import "./globals.css";
import { AuthSessionProvider } from "@/components/auth-session-provider";
import { MaintenanceGate } from "@/components/maintenance-gate";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PriceTicker } from "@/components/price-ticker";
import { SolanaWalletProvider } from "@/components/solana/solana-wallet-provider";
import { rootSiteMetadata } from "@/lib/site-metadata";

const zenDots = localFont({
  src: "../fonts/ZenDots-Regular.ttf",
  variable: "--font-zen-dots",
  display: "swap",
  weight: "400",
});

const michroma = localFont({
  src: "../fonts/Michroma-Regular.ttf",
  variable: "--font-michroma",
  display: "swap",
  weight: "400",
});

const previewDisplay = Alfa_Slab_One({
  variable: "--font-preview-display",
  subsets: ["latin"],
  weight: "400",
});

const previewBody = Rowdies({
  variable: "--font-preview-body",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = rootSiteMetadata;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = (await headers()).get("x-pathname") ?? "";
  const useSiteShell = !pathname.startsWith("/admin");

  return (
    <html lang="en" className="dark">
      <body
        className={`${zenDots.variable} ${michroma.variable} ${geistSans.variable} ${geistMono.variable} font-sans antialiased overflow-x-clip`}
      >
        {useSiteShell ? <div aria-hidden className="preview-fixed-bg" /> : null}
        <SolanaWalletProvider>
          <AuthSessionProvider>
          <MaintenanceGate>
            <div
                className={
                  useSiteShell
                    ? `${previewDisplay.variable} ${previewBody.variable} preview-shell relative z-[1] min-h-dvh w-full`
                    : "min-h-dvh w-full max-w-full overflow-x-hidden"
                }
              >
              <div
                className={
                  useSiteShell
                    ? "mx-auto flex min-h-dvh w-full min-w-0 max-w-[1440px] flex-col px-5 pb-10 sm:px-8"
                    : "mx-auto flex min-h-dvh w-full min-w-0 max-w-6xl flex-col px-4 pb-8 pt-4 sm:px-6"
                }
              >
                {useSiteShell ? (
                  <div className="sticky top-0 z-[120] -mx-5 bg-transparent px-5 pb-2 pt-3 sm:-mx-8 sm:px-8">
                    <div
                      aria-hidden
                      className="preview-scroll-fade pointer-events-none absolute inset-x-0 top-0 -bottom-18 -z-10"
                    >
                      <div className="preview-scroll-fade-bg" />
                    </div>
                    <SiteHeader />
                    <PriceTicker />
                  </div>
                ) : (
                  <>
                    <SiteHeader />
                    <PriceTicker />
                  </>
                )}
                <main className="mt-8 min-w-0 max-w-full flex-1">{children}</main>
                <SiteFooter />
              </div>
            </div>
          </MaintenanceGate>
          </AuthSessionProvider>
        </SolanaWalletProvider>
      </body>
    </html>
  );
}
