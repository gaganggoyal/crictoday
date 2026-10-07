import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import {
  ATTENDANCE_COPY,
  priceLabel,
  resolveAttendance,
  ticketRoute,
} from "@/lib/domain/ticket-state";
import { formatShortDate } from "@/lib/domain/time";
import type { StoredMatch } from "@/lib/domain/types";
import { RequestForm } from "@/components/forms/request-form";
import { TicketBadge } from "@/components/match/ticket-badge";

export function TicketPanel({ match, now }: { match: StoredMatch; now: Date }) {
  const state = resolveAttendance(match, match.offers, now);
  const copy = ATTENDANCE_COPY[state];
  const route = ticketRoute(match, now);
  const price = route ? priceLabel(route.offer, now) : null;
  const alert = state === "REQUEST_ALERT" || state === "SOLD_OUT" || state === "POSTPONED";

  return (
    <aside className="grid gap-4 rounded-[1.25rem] border border-line bg-surface p-5 shadow-[0_12px_40px_rgba(22,32,24,0.06)]">
      <TicketBadge state={state} />
      <div>
        <h2 className="font-display text-2xl font-extrabold">{copy.label}</h2>
        <p className="mt-2 text-sm text-muted">{copy.description}</p>
      </div>
      {route ? (
        <div className="grid gap-2 rounded-2xl bg-background p-4 text-sm">
          <p>
            <span className="text-muted">Seller: </span>
            <span className="font-medium">{route.offer.sellerName}</span>
          </p>
          <p>
            <span className="text-muted">Domain: </span>
            <span className="font-medium">{route.offer.sellerDomain}</span>
          </p>
          {route.checkedAt ? (
            <p>
              <span className="text-muted">Checked: </span>
              <span className="font-medium">
                {formatShortDate(route.checkedAt, match.timezone)}
              </span>
            </p>
          ) : null}
          {price ? (
            <p>
              <span className="text-muted">From: </span>
              <span className="font-medium">{price}</span>
            </p>
          ) : (
            <p className="text-muted">No current price is shown.</p>
          )}
          <Link
            href={`/go/${route.offer.id}`}
            className="mt-2 inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-[#176B43] px-5 font-medium text-white"
          >
            {copy.cta}
            <ArrowUpRight aria-hidden="true" size={18} />
          </Link>
          <p className="text-xs leading-5 text-muted">
            You continue to the seller&apos;s own site. Check the match details and their terms
            before you pay.
          </p>
        </div>
      ) : null}
      {state === "FREE_ENTRY" || state === "PRIVATE_EVENT" || state === "CANCELLED" ? (
        <div className="rounded-2xl bg-background p-4 text-sm">
          <p>{match.entryNotes || "No further public note has been verified."}</p>
        </div>
      ) : null}
      {alert ? <RequestForm matchSlug={match.slug} cta={copy.cta} /> : null}
      {state === "IN_PLAY" || state === "FINISHED" ? (
        <Link
          href="/matches"
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-line px-5 text-sm font-medium no-underline"
        >
          {copy.cta}
        </Link>
      ) : null}
      <p className="text-xs leading-5 text-muted">
        cricketmatch.today does not sell tickets or run resale.{" "}
        <Link href="/how-we-check-ticket-links" className="text-link underline underline-offset-2">
          How we check ticket links
        </Link>
      </p>
    </aside>
  );
}
