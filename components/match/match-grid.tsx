import { MatchCard } from "@/components/match/match-card";
import type { StoredMatch } from "@/lib/domain/types";

export function MatchGrid({ matches, now }: { matches: StoredMatch[]; now: Date }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {matches.map((match) => (
        <MatchCard key={match.slug} match={match} now={now} />
      ))}
    </div>
  );
}

export function EmptyResults({ title = "No matches in this view" }: { title?: string }) {
  return (
    <div className="rounded-[1.25rem] border border-dashed border-line bg-surface p-8">
      <h2 className="font-display text-2xl font-extrabold">{title}</h2>
      <p className="mt-2 max-w-lg text-muted">
        Remove a filter, try another city, or tell us a fixture is missing so a moderator can review it.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <a className="inline-flex min-h-11 items-center rounded-full bg-[#176B43] px-5 font-medium text-white" href="/matches">
          Clear filters
        </a>
        <a className="inline-flex min-h-11 items-center rounded-full border border-line px-5 font-medium" href="/submit/match">
          Submit a missing match
        </a>
      </div>
    </div>
  );
}
