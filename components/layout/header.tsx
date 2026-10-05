"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const links = [
  { href: "/matches", label: "Matches" },
  { href: "/countries", label: "Countries" },
  { href: "/leagues", label: "Top Leagues" },
  { href: "/academies", label: "Academies" },
];

export function Header({ email, staff }: { email: string | null; staff: boolean }) {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-[1120px] items-center gap-3 px-5">
        <Link href="/" aria-label="cricketmatch.today home" className="mr-auto md:mr-0">
          <Logo compact className="md:hidden" />
          <Logo className="hidden md:inline-flex" />
        </Link>
        <nav aria-label="Primary" className="mx-auto hidden items-center gap-1 md:flex">
          {links.map((link) => {
            const active =
              pathname === link.href ||
              pathname.startsWith(`${link.href}/`) ||
              (link.href === "/matches" && pathname.startsWith("/match/"));
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-full px-3 text-sm font-medium",
                  active ? "bg-surface text-foreground" : "text-muted hover:text-foreground",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <Link
            href="/matches?tickets=alert"
            className="hidden min-h-11 items-center px-2 text-sm font-medium lg:inline-flex"
          >
            Request tickets
          </Link>
          <ThemeToggle />
          {email ? (
            <Button
              href={staff ? "/admin" : "/dashboard"}
              variant="outline"
              className="hidden sm:inline-flex"
            >
              Account
            </Button>
          ) : (
            <Button href="/login" variant="ghost" className="hidden sm:inline-flex">
              Sign in
            </Button>
          )}
          <Button href="/submit/match" className="px-4">
            List a match
          </Button>
        </div>
      </div>
    </header>
  );
}
