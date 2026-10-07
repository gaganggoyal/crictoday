"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { CategoryBar, MenuDrawer, type MenuData } from "@/components/layout/site-menu";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";

export function Header({
  email,
  staff,
  menu,
}: {
  email: string | null;
  staff: boolean;
  menu: MenuData;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-[1120px] items-center gap-2 px-3 sm:px-5">
        <MenuDrawer menu={menu} email={email} />
        <Link href="/" aria-label="cricketmatch.today home" className="mr-auto md:mr-4">
          <Logo compact className="md:hidden" />
          <Logo className="hidden md:inline-flex" />
        </Link>
        <form
          action="/matches"
          method="get"
          role="search"
          className="mr-auto hidden max-w-md flex-1 lg:flex"
        >
          <label className="flex min-h-11 w-full items-center gap-2 rounded-full border border-line bg-surface px-4">
            <Search aria-hidden="true" size={17} className="shrink-0 text-muted" />
            <span className="sr-only">Search matches</span>
            <input
              name="q"
              type="search"
              placeholder="Search teams, cities and grounds"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
            />
          </label>
        </form>
        <div className="flex items-center gap-2">
          <Link
            href="/matches?tickets=alert"
            className="hidden min-h-11 items-center px-2 text-sm font-medium xl:inline-flex"
          >
            Ticket alerts
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
          <Button href="/get-listed" className="px-4">
            <span className="sm:hidden">List club</span>
            <span className="hidden sm:inline">List your club</span>
          </Button>
        </div>
      </div>
      <CategoryBar menu={menu} />
    </header>
  );
}
