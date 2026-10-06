import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import localFont from "next/font/local";
import { Analytics } from "@/components/analytics";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { MobileNav } from "@/components/layout/mobile-nav";
import { AppThemeProvider } from "@/components/theme/provider";
import { getSession, isStaff } from "@/lib/auth/session";
import { showDemoBanner } from "@/lib/data/catalog";
import { countries, leagues } from "@/lib/data/seed";
import { siteSocialImage } from "@/lib/seo";
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

const description =
  "Find cricket matches today and upcoming fixtures by country, city and league, with grounds, local start times and official ticket links checked by a person.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  applicationName: "cricketmatch.today",
  title: {
    default: "Cricket matches today, fixtures and tickets · cricketmatch.today",
    template: "%s · cricketmatch.today",
  },
  description,
  openGraph: {
    siteName: "cricketmatch.today",
    title: "Cricket matches today, fixtures and tickets",
    description,
    type: "website",
    locale: "en_IN",
    images: [siteSocialImage()],
  },
  twitter: { card: "summary_large_image" },
  // Set GOOGLE_SITE_VERIFICATION to the token Search Console gives for the HTML tag method.
  ...(process.env.GOOGLE_SITE_VERIFICATION
    ? { verification: { google: process.env.GOOGLE_SITE_VERIFICATION } }
    : {}),
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f5ef" },
    { media: "(prefers-color-scheme: dark)", color: "#101612" },
  ],
};

// India first, then the other countries by name.
const menu = {
  countries: [...countries]
    .sort((a, b) =>
      a.slug === "india" ? -1 : b.slug === "india" ? 1 : a.name.localeCompare(b.name),
    )
    .map(({ slug, name }) => ({ slug, name })),
  leagues: leagues.map(({ slug, name, seasonName }) => ({ slug, name, seasonName })),
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  const demo = await showDemoBanner();

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
          <Header
            email={session?.email ?? null}
            staff={session ? isStaff(session.role) : false}
            menu={menu}
          />
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
