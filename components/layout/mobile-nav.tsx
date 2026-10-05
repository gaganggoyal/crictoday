"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Flag, Trophy, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/matches", label: "Matches", icon: CalendarDays },
  { href: "/countries", label: "Countries", icon: Flag },
  { href: "/leagues", label: "Leagues", icon: Trophy },
  { href: "/academies", label: "Academies", icon: Building2 },
];

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Mobile"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur md:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-4">
        {items.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href ||
            pathname.startsWith(`${item.href}/`) ||
            (item.href === "/matches" && pathname.startsWith("/match/"));
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium",
                  active ? "text-link" : "text-muted",
                )}
              >
                <Icon aria-hidden="true" size={18} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
