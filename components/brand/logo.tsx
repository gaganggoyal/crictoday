import { cn } from "@/lib/utils";

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 text-foreground", className)}>
      <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
        <rect width="32" height="32" rx="8" fill="#176B43" />
        <rect x="8" y="9" width="2" height="13" rx="1" fill="#F3F5EF" />
        <rect x="15" y="8" width="2" height="14" rx="1" fill="#F3F5EF" />
        <rect x="22" y="9" width="2" height="13" rx="1" fill="#F3F5EF" />
        <circle cx="25" cy="23" r="3.2" fill="#D85F25" />
      </svg>
      {compact ? (
        <span className="font-display text-lg font-extrabold tracking-tight">cricketmatch</span>
      ) : (
        <span className="font-display text-lg leading-none font-extrabold tracking-tight">
          cricketmatch<span className="text-ball">.today</span>
        </span>
      )}
    </span>
  );
}
