import Link from "next/link";
import { BadgeCheck, MapPin } from "lucide-react";
import { FORMAT_LABEL } from "@/lib/domain/labels";
import { isStale, resolveAttendance, ticketRoute } from "@/lib/domain/ticket-state";
import { formatInTimeZone, formatShortDate } from "@/lib/domain/time";
import type { StoredMatch } from "@/lib/domain/types";
import { TicketBadge } from "@/components/match/ticket-badge";

export function MatchCard({ match, now }: { match: StoredMatch; now: Date }) {
  const state = resolveAttendance(match, match.offers, now);
  const route = ticketRoute(match, now);
  const stale = isStale(match.lastVerifiedAt, now);
  const muted = state === "CANCELLED" || state === "POSTPONED";
  return (
    <article
      className={`flex h-full flex-col overflow-hidden rounded-[1.25rem] border bg-surface shadow-[0_1px_0_rgba(22,32,24,0.04)] ${muted ? "border-[#8C2F1B]" : "border-line"}`}
    >
      <div className="flex items-start justify-between gap-3 px-4 pt-4">
        <p className="text-xs font-semibold tracking-[0.14em] text-muted uppercase">
          {match.competitionName}
        </p>
        <TicketBadge state={state} />
      </div>
      <Link href={`/match/${match.slug}`} className="group grid gap-4 px-4 py-4 no-underline">
        <span className="sr-only">
          {match.homeName} versus {match.awayName}
        </span>
        <span className="flex items-end justify-between gap-3" aria-hidden="true">
          <Team name={match.homeName} code={match.homeShort} />
          <span className="mb-2 text-[11px] font-semibold tracking-[0.2em] text-muted">VS</span>
          <Team name={match.awayName} code={match.awayShort} align="right" />
        </span>
      </Link>
      <div className="relative mt-auto border-t border-dashed border-line px-4 py-3 text-sm">
        <span className="absolute top-0 -left-2 h-4 w-4 -translate-y-1/2 rounded-full bg-background" />
        <span className="absolute top-0 -right-2 h-4 w-4 -translate-y-1/2 rounded-full bg-background" />
        <p className="font-medium">{formatInTimeZone(match.startsAt, match.timezone)}</p>
        <p className="mt-1 flex items-start gap-1.5 text-muted">
          <MapPin aria-hidden="true" size={16} className="mt-0.5 shrink-0" />
          <span>
            {match.venueName}, {match.cityName}
          </span>
        </p>
        {route ? (
          <p className="mt-1 flex items-start gap-1.5">
            <BadgeCheck aria-hidden="true" size={16} className="mt-0.5 shrink-0 text-link" />
            <span>
              <span className="text-muted">Seller </span>
              <span className="font-medium">{route.offer.sellerDomain}</span>
              {route.checkedAt ? (
                <span className="text-muted">
                  {" "}
                  · checked {formatShortDate(route.checkedAt, match.timezone)}
                </span>
              ) : null}
            </span>
          </p>
        ) : null}
        <p className="mt-2 flex flex-wrap gap-2 text-xs text-muted">
          <span className="rounded-full border border-line px-2 py-1">
            {FORMAT_LABEL[match.format]}
          </span>
          <span className="rounded-full border border-line px-2 py-1">{match.countryName}</span>
          {match.demo ? (
            <span className="rounded-full border border-line px-2 py-1">DEMO</span>
          ) : null}
          {stale ? (
            <span className="rounded-full border border-warning px-2 py-1 text-warning">
              Check verification
            </span>
          ) : null}
        </p>
      </div>
    </article>
  );
}

function Team({
  name,
  code,
  align = "left",
}: {
  name: string;
  code: string;
  align?: "left" | "right";
}) {
  return (
    <span className={align === "right" ? "text-right" : "text-left"}>
      <span className="font-display block text-3xl leading-none font-extrabold tracking-tight group-hover:text-link">
        {code}
      </span>
      <span className="mt-1 block max-w-36 text-sm text-muted">{name}</span>
    </span>
  );
}
