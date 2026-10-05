import type { AttendanceState, StoredMatch, StoredOffer } from "@/lib/domain/types";

export const PRICE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

export const ATTENDANCE_COPY: Record<
  AttendanceState,
  { label: string; cta: string; description: string }
> = {
  OFFICIAL_LINK: {
    label: "Tickets available",
    cta: "View official tickets",
    description: "Opens a reviewed seller. The destination domain is shown before you leave.",
  },
  AUTHORISED_PARTNER: {
    label: "Authorised partner",
    cta: "View ticket options",
    description: "Opens an approved partner. This is not a resale listing.",
  },
  REQUEST_ALERT: {
    label: "Sale not found/open",
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
};

export function resolveAttendance(
  match: Pick<StoredMatch, "status" | "attendanceType">,
  offers: StoredOffer[],
): AttendanceState {
  if (match.status === "cancelled") return "CANCELLED";
  if (match.status === "postponed") return "POSTPONED";
  if (match.attendanceType === "private") return "PRIVATE_EVENT";
  if (match.attendanceType === "free") return "FREE_ENTRY";

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
    "CANCELLED",
  ];
  return order.indexOf(state);
}
