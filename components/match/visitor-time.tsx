"use client";

import { useState } from "react";
import { useHydrated } from "@/components/use-hydrated";

export function VisitorTime({ iso }: { iso: string }) {
  const hydrated = useHydrated();
  const label = hydrated
    ? new Intl.DateTimeFormat("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        timeZoneName: "short",
      }).format(new Date(iso))
    : null;

  return (
    <p className="text-sm text-muted">
      <span className="font-medium text-foreground">Your time: </span>
      {label ?? "Your local time appears after this page loads."}
    </p>
  );
}

export function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm font-medium"
      onClick={async () => {
        const url = window.location.href;
        if (navigator.share) {
          try {
            await navigator.share({ title, url });
            return;
          } catch {
            // Fall through to copy when share is dismissed.
          }
        }
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
        } catch {
          setCopied(false);
        }
      }}
    >
      {copied ? "Link copied" : "Share"}
    </button>
  );
}
