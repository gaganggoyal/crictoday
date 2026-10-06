"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

/**
 * On a phone the filters past the search box fold away, so results come first. From the lg
 * breakpoint they always show, as a sidebar.
 */
export function MoreFilters({ active, children }: { active: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="inline-flex min-h-11 items-center justify-between gap-2 rounded-full border border-line px-4 text-sm font-medium lg:hidden"
        aria-expanded={open}
        aria-controls="more-filters"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? "Fewer filters" : "More filters"}
        {active ? ` · ${active} set` : ""}
        <ChevronDown
          aria-hidden="true"
          size={18}
          className={open ? "rotate-180 transition-transform" : "transition-transform"}
        />
      </button>
      <div id="more-filters" className={open ? "grid gap-4" : "hidden gap-4 lg:grid"}>
        {children}
      </div>
    </>
  );
}
