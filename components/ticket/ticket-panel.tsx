import Link from "next/link";
import { ATTENDANCE_COPY, priceLabel, primaryOffer } from "@/lib/domain/ticket-state";
import type { StoredMatch } from "@/lib/domain/types";
import { RequestForm } from "@/components/forms/request-form";
import { TicketBadge } from "@/components/match/ticket-badge";
import { resolveAttendance } from "@/lib/domain/ticket-state";

export function TicketPanel({ match, now }: { match: StoredMatch; now: Date }) {
  const state = resolveAttendance(match, match.offers);
  const copy = ATTENDANCE_COPY[state];
  const offer = primaryOffer(match.offers);
  const price = priceLabel(offer, now);
  const alert = state === "REQUEST_ALERT" || state === "SOLD_OUT" || state === "POSTPONED";

  return (
    <aside className="grid gap-4 rounded-[1.25rem] border border-line bg-surface p-5 shadow-[0_12px_40px_rgba(22,32,24,0.06)]">
      <TicketBadge state={state} />
      <div>
        <h2 className="font-display text-2xl font-extrabold">{copy.label}</h2>
        <p className="mt-2 text-sm text-muted">{copy.description}</p>
      </div>
      {offer && (state === "OFFICIAL_LINK" || state === "AUTHORISED_PARTNER") ? (
        <div className="grid gap-2 rounded-2xl bg-background p-4 text-sm">
          <p>
            <span className="text-muted">Seller: </span>
            <span className="font-medium">{offer.sellerName}</span>
          </p>
          <p>
            <span className="text-muted">Domain: </span>
            <span className="font-medium">{offer.sellerDomain}</span>
          </p>
          {price ? (
            <p>
              <span className="text-muted">From: </span>
              <span className="font-medium">{price}</span>
              <span className="text-muted">, checked {offer.lastCheckedAt ? new Date(offer.lastCheckedAt).toUTCString() : ""}</span>
            </p>
          ) : (
            <p className="text-muted">No current price is shown.</p>
          )}
          <Link
            href={`/go/${offer.id}`}
            className="mt-2 inline-flex min-h-11 items-center justify-center rounded-full bg-[#176B43] px-5 font-medium text-white"
          >
            {copy.cta}
          </Link>
        </div>
      ) : null}
      {state === "FREE_ENTRY" || state === "PRIVATE_EVENT" || state === "CANCELLED" ? (
        <div className="rounded-2xl bg-background p-4 text-sm">
          <p>{match.entryNotes || "No further public note has been verified."}</p>
        </div>
      ) : null}
      {alert ? <RequestForm matchSlug={match.slug} cta={copy.cta} /> : null}
      <p className="text-xs leading-5 text-muted">
        cricketmatch.today does not sell tickets. Leaving this site is your choice, and only after the seller domain is shown.
      </p>
    </aside>
  );
}
