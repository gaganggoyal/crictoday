export type Role = "fan" | "academy_owner" | "organiser" | "moderator" | "admin";

export type MatchFormat = "test" | "odi" | "t20" | "t10" | "hundred" | "other";
export type MatchStatus =
  | "draft"
  | "pending"
  | "published"
  | "postponed"
  | "cancelled"
  | "completed";
export type AttendanceType = "ticketed" | "free" | "private" | "unknown";
export type CompetitionKind = "international" | "league" | "domestic" | "academy";
export type SourceType = "api" | "organiser" | "academy" | "admin";
export type TicketKind = "official" | "authorised_partner" | "affiliate";
export type TicketOfferStatus = "pending" | "active" | "sold_out" | "expired" | "rejected";

export type AttendanceState =
  | "OFFICIAL_LINK"
  | "AUTHORISED_PARTNER"
  | "REQUEST_ALERT"
  | "FREE_ENTRY"
  | "SOLD_OUT"
  | "PRIVATE_EVENT"
  | "CANCELLED"
  | "POSTPONED";

export type StoredOffer = {
  id: string;
  sellerName: string;
  sellerDomain: string;
  url: string;
  kind: TicketKind;
  currency: string | null;
  priceFrom: number | null;
  status: TicketOfferStatus;
  lastCheckedAt: string | null;
  approved: boolean;
};

export type StoredMatch = {
  id: string;
  slug: string;
  competitionName: string;
  competitionSlug: string;
  kind: CompetitionKind;
  seasonName: string | null;
  seasonSlug: string | null;
  homeName: string;
  homeShort: string;
  homeSlug: string;
  awayName: string;
  awayShort: string;
  awaySlug: string;
  venueName: string;
  venueSlug: string;
  venueAddress: string;
  cityName: string;
  citySlug: string;
  countryName: string;
  countrySlug: string;
  startsAt: string;
  endsAt: string | null;
  timezone: string;
  format: MatchFormat;
  status: MatchStatus;
  attendanceType: AttendanceType;
  sourceType: SourceType;
  sourceExternalId: string | null;
  sourceUrl: string | null;
  sourceLabel: string;
  featuredRank: number;
  lastVerifiedAt: string | null;
  publishedAt: string | null;
  entryNotes: string | null;
  demo: boolean;
  academySlug: string | null;
  offers: StoredOffer[];
};

export type StoredAcademy = {
  id: string;
  slug: string;
  name: string;
  description: string;
  address: string;
  cityName: string;
  citySlug: string;
  countryName: string;
  countrySlug: string;
  website: string | null;
  phone: string | null;
  contactEmail: string | null;
  ageGroups: string[];
  facilities: string[];
  verificationStatus: "unverified" | "pending" | "verified" | "rejected";
  verificationLabel: string | null;
  lastVerifiedAt: string | null;
  ownerEmail: string | null;
  demo: boolean;
};

export type CountryInfo = {
  slug: string;
  name: string;
  iso2: string;
  timezone: string;
  ticketGuidance: string;
  blurb: string;
  launch: boolean;
};

export type LeagueInfo = {
  slug: string;
  name: string;
  kind: CompetitionKind;
  officialUrl: string;
  summary: string;
  ticketGuidance: string;
  seasonSlug: string;
  seasonName: string;
  startsAt: string;
  endsAt: string;
};

export type SubmissionStatus =
  | "pending"
  | "in_review"
  | "approved"
  | "rejected"
  | "changes_requested";

export type Submission = {
  id: string;
  entityType: "match" | "academy" | "ticket_offer" | "correction";
  payload: Record<string, unknown>;
  submitterEmail: string | null;
  status: SubmissionStatus;
  duplicateOf: string | null;
  reviewerEmail: string | null;
  reviewerNotes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TicketRequestStatus =
  | "pending_verification"
  | "active"
  | "notified"
  | "unsubscribed"
  | "expired";

export type TicketRequestRecord = {
  id: string;
  matchSlug: string;
  emailHash: string;
  encryptedEmail: string;
  quantity: number;
  countryCode: string;
  notes: string | null;
  consentAt: string;
  verifiedAt: string | null;
  status: TicketRequestStatus;
  verifyTokenHash: string;
  unsubTokenHash: string;
  createdAt: string;
};

export type AuditRecord = {
  id: string;
  actorEmail: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before: unknown;
  after: unknown;
  createdAt: string;
};

export type ImportRun = {
  id: string;
  provider: string;
  startedAt: string;
  finishedAt: string | null;
  fetchedCount: number;
  insertedCount: number;
  updatedCount: number;
  failedCount: number;
  status: "running" | "succeeded" | "failed" | "skipped";
  errorSummary: string | null;
};

export type StoreUser = {
  id: string;
  email: string;
  role: Role;
  displayName: string;
  countryCode: string | null;
  createdAt: string;
};

export type MagicLink = {
  tokenHash: string;
  email: string;
  role: Role;
  expiresAt: string;
  usedAt: string | null;
};

export type OutboxMessage = {
  id: string;
  to: string;
  subject: string;
  text: string;
  createdAt: string;
};

export type DeadLetter = {
  id: string;
  provider: string;
  reason: string;
  createdAt: string;
};

export type ClickRecord = {
  id: string;
  matchSlug: string;
  offerId: string;
  referrer: string | null;
  createdAt: string;
};

export type StoreShape = {
  version: 1;
  users: StoreUser[];
  magicLinks: MagicLink[];
  submissions: Submission[];
  requests: TicketRequestRecord[];
  clicks: ClickRecord[];
  audit: AuditRecord[];
  extraMatches: StoredMatch[];
  extraAcademies: StoredAcademy[];
  overrides: Record<string, Partial<StoredMatch>>;
  academyOverrides: Record<string, Partial<StoredAcademy>>;
  importRuns: ImportRun[];
  deadLetters: DeadLetter[];
  allowDomains: string[];
  denyDomains: string[];
  outbox: OutboxMessage[];
};

export const PUBLIC_MATCH_STATUSES: MatchStatus[] = [
  "published",
  "postponed",
  "cancelled",
  "completed",
];

export function isPublicMatch(match: Pick<StoredMatch, "status" | "sourceUrl">) {
  return PUBLIC_MATCH_STATUSES.includes(match.status) && Boolean(match.sourceUrl);
}
