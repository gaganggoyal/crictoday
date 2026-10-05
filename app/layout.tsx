import type { Metadata } from "next";
import type { ReactNode } from "react";
import localFont from "next/font/local";
import { Analytics } from "@/components/analytics";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { MobileNav } from "@/components/layout/mobile-nav";
import { AppThemeProvider } from "@/components/theme/provider";
import { getSession, isStaff } from "@/lib/auth/session";
import { dataMode } from "@/lib/data/mode";
import { siteUrl } from "@/lib/utils";
import "./globals.css";

const cabinet = localFont({
  src: [
    { path: "../fonts/cabinet-grotesk-500.woff2", weight: "500", style: "normal" },
    { path: "../fonts/cabinet-grotesk-700.woff2", weight: "700", style: "normal" },
    { path: "../fonts/cabinet-grotesk-800.woff2", weight: "800", style: "normal" },
  ],
  variable: "--font-cabinet",
  display: "swap",
});

const satoshi = localFont({
  src: [
    { path: "../fonts/satoshi-400.woff2", weight: "400", style: "normal" },
    { path: "../fonts/satoshi-500.woff2", weight: "500", style: "normal" },
    { path: "../fonts/satoshi-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-satoshi",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: "cricketmatch.today — Find the match. Feel the ground.",
    template: "%s · cricketmatch.today",
  },
  description: "Upcoming cricket matches, venues and official ticket links by country.",
  openGraph: {
    siteName: "cricketmatch.today",
    title: "Find the match. Feel the ground.",
    description: "Upcoming cricket matches, venues and official ticket links by country.",
    type: "website",
  },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  const demo = dataMode() === "demo";

  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${cabinet.variable} ${satoshi.variable} h-full max-md:scroll-pb-24`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col bg-background font-sans text-foreground antialiased">
        <AppThemeProvider>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-surface focus:px-4 focus:py-3"
          >
            Skip to content
          </a>
          {demo ? (
            <p className="bg-[#162018] px-5 py-2 text-center text-sm text-[#F3F5EF]">
              Demo inventory. Fixtures, prices and ticket links are illustrative and labelled DEMO.
            </p>
          ) : null}
          <Header email={session?.email ?? null} staff={session ? isStaff(session.role) : false} />
          <main id="main" className="min-w-0 flex-1 pb-20 md:pb-0">
            {children}
          </main>
          <Footer demo={demo} email={session?.email ?? null} />
          <MobileNav />
          <Analytics />
        </AppThemeProvider>
      </body>
    </html>
  );
}
