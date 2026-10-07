import { DAY_MINUTES } from "@/lib/domain/calendar";
import type { AttendanceState, StoredMatch, StoredOffer } from "@/lib/domain/types";

export const PRICE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;
/** Rain and long days run late, so a match counts as finished only this long after it should end. */
const OVERRUN_MS = 2 * 60 * MINUTE_MS;

export const ATTENDANCE_COPY: Record<
  AttendanceState,
  { label: string; cta: string; description: string }
> = {
  OFFICIAL_LINK: {
    label: "Tickets available",
    cta: "View official ticket source",
    description: "Opens a reviewed seller. The destination domain is shown before you leave.",
  },
  AUTHORISED_PARTNER: {
    label: "Authorised seller",
    cta: "View authorised ticket seller",
    description: "Opens a seller the organiser has authorised. This is not a resale listing.",
  },
  REQUEST_ALERT: {
    label: "No official link yet",
    cta: "Request ticket alert",
    description:
      "We email you if an approved offer is later listed. A request does not reserve a seat.",
  },
  FREE_ENTRY: {
    label: "Free entry",
    cta: "View entry details",
    description: "No ticket link. Follow the gate, time and rules supplied by the organiser.",
  },
  SOLD_OUT: {
    label: "Sold out",
    cta: "Join update list",
    description: "The approved offer is sold out. An update does not guarantee a returned seat.",
  },
  PRIVATE_EVENT: {
    label: "Private match",
    cta: "View organiser note",
    description: "This fixture is not open for public tickets.",
  },
  CANCELLED: {
    label: "Cancelled",
    cta: "View update",
    description: "This match has been cancelled. Ticket actions are closed.",
  },
  POSTPONED: {
    label: "Postponed",
    cta: "Get date alert",
    description: "The date is not confirmed. We email you after a verified reschedule.",
  },
  IN_PLAY: {
    label: "Under way",
    cta: "See upcoming matches",
    description: "This match has started. Its ticket links and alerts are closed.",
  },
  FINISHED: {
    label: "Finished",
    cta: "See upcoming matches",
    description: "This match is over. Its ticket links and alerts are closed.",
  },
};

/** When a match should be over: its end time, or a typical day's play after it starts. */
export function expectedEnd(match: Pick<StoredMatch, "startsAt" | "endsAt" | "format">) {
  const start = Date.parse(match.startsAt);
  const end = match.endsAt ? Date.parse(match.endsAt) : Number.NaN;
  if (end > start) return end;
  // A Test runs for five days.
  const days = match.format === "test" ? 4 : 0;
  return start + days * DAY_MS + DAY_MINUTES[match.format] * MINUTE_MS;
}

/** Whether a match is over: marked completed, or two hours past when it should have ended. */
export function isOver(
  match: Pick<StoredMatch, "status" | "startsAt" | "endsAt" | "format">,
  now: Date,
) {
  return match.status === "completed" || now.getTime() >= expectedEnd(match) + OVERRUN_MS;
}

/**
 * The one attendance state a match shows. Cancelled and postponed come first, then a match that is
 * over. A private or free match keeps its state while it is on, since people can still walk in to a
 * free one. Any other match that has started closes its ticket links and alerts.
 */
export function resolveAttendance(
  match: Pick<StoredMatch, "status" | "attendanceType" | "format" | "startsAt" | "endsAt">,
  offers: StoredOffer[],
  now: Date,
): AttendanceState {
  if (match.status === "cancelled") return "CANCELLED";
  if (match.status === "postponed") return "POSTPONED";
  if (isOver(match, now)) return "FINISHED";
  if (match.attendanceType === "private") return "PRIVATE_EVENT";
  if (match.attendanceType === "free") return "FREE_ENTRY";
  if (now.getTime() >= Date.parse(match.startsAt)) return "IN_PLAY";

  const active = offers.filter((offer) => offer.approved && offer.status === "active");
  if (active.some((offer) => offer.kind === "official")) return "OFFICIAL_LINK";
  if (active.some((offer) => offer.kind === "authorised_partner" || offer.kind === "affiliate")) {
    return "AUTHORISED_PARTNER";
  }
  if (offers.some((offer) => offer.approved && offer.status === "sold_out")) return "SOLD_OUT";
  return "REQUEST_ALERT";
}

export function primaryOffer(offers: StoredOffer[]) {
  const active = offers.filter((offer) => offer.approved && offer.status === "active");
  return (
    active.find((offer) => offer.kind === "official") ??
    active.find((offer) => offer.kind === "authorised_partner" || offer.kind === "affiliate") ??
    offers.find((offer) => offer.approved && offer.status === "sold_out") ??
    null
  );
}

/** The approved seller a match's ticket button opens, and when that link was last checked. */
export function ticketRoute(match: StoredMatch, now: Date) {
  const state = resolveAttendance(match, match.offers, now);
  if (state !== "OFFICIAL_LINK" && state !== "AUTHORISED_PARTNER") return null;
  const offer = primaryOffer(match.offers);
  if (!offer) return null;
  return { state, offer, checkedAt: offer.lastCheckedAt ?? match.lastVerifiedAt };
}

export function priceLabel(offer: StoredOffer | null, now: Date) {
  if (!offer?.approved || !offer.currency || offer.priceFrom == null || !offer.lastCheckedAt) {
    return null;
  }
  const age = now.getTime() - new Date(offer.lastCheckedAt).getTime();
  if (!Number.isFinite(age) || age < 0 || age > PRICE_MAX_AGE_MS) return null;
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: offer.currency,
    maximumFractionDigits: 0,
  }).format(offer.priceFrom);
}

export function isStale(lastVerifiedAt: string | null, now: Date) {
  if (!lastVerifiedAt) return true;
  const age = now.getTime() - new Date(lastVerifiedAt).getTime();
  return !Number.isFinite(age) || age > STALE_AFTER_MS;
}

export function ticketSortRank(state: AttendanceState) {
  const order: AttendanceState[] = [
    "OFFICIAL_LINK",
    "AUTHORISED_PARTNER",
    "FREE_ENTRY",
    "REQUEST_ALERT",
    "SOLD_OUT",
    "POSTPONED",
    "PRIVATE_EVENT",
    "IN_PLAY",
    "FINISHED",
    "CANCELLED",
  ];
  return order.indexOf(state);
}
