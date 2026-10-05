import { findDuplicateCandidates } from "@/lib/domain/duplicates";
import { slugify, uniqueSlug } from "@/lib/domain/slug";
import { zonedTimeToUtc } from "@/lib/domain/time";
import type {
  AcademySubmissionInput,
  MatchSubmissionInput,
  TicketRequestInput,
} from "@/lib/validation/schemas";
import { assertHttpsUrl, isDeniedDomain } from "@/lib/domain/urls";
import type { NormalizedMatch } from "@/lib/domain/providers";
import type {
  AuditRecord,
  OutboxMessage,
  Role,
  StoreShape,
  StoredAcademy,
  StoredMatch,
  StoredOffer,
  Submission,
} from "@/lib/domain/types";
import { DEFAULT_ALLOW_DOMAINS, DEFAULT_DENY_DOMAINS, academies, matches } from "@/lib/data/seed";

export type EmailDraft = { to: string; subject: string; text: string };

export type WorkflowFailure = { ok: false; errors: Record<string, string>; store?: StoreShape };
export type WorkflowSuccess<T> = {
  ok: true;
  store: StoreShape;
  emails: EmailDraft[];
  result: T;
};
export type WorkflowResult<T> = WorkflowSuccess<T> | WorkflowFailure;

export function emptyStore(): StoreShape {
  return {
    version: 1,
    users: [],
    magicLinks: [],
    submissions: [],
    requests: [],
    clicks: [],
    audit: [],
    extraMatches: [],
    extraAcademies: [],
    overrides: {},
    academyOverrides: {},
    importRuns: [],
    deadLetters: [],
    allowDomains: [...DEFAULT_ALLOW_DOMAINS],
    denyDomains: [...DEFAULT_DENY_DOMAINS],
    outbox: [],
  };
}

export function mergeMatches(store: StoreShape): StoredMatch[] {
  const map = new Map(matches.map((match) => [match.slug, structuredClone(match)]));
  for (const match of store.extraMatches) map.set(match.slug, structuredClone(match));
  for (const [slug, patch] of Object.entries(store.overrides)) {
    const base = map.get(slug);
    if (!base) continue;
    map.set(slug, { ...base, ...patch, offers: patch.offers ?? base.offers });
  }
  return [...map.values()];
}

export function mergeAcademies(store: StoreShape): StoredAcademy[] {
  const map = new Map(academies.map((academy) => [academy.slug, structuredClone(academy)]));
  for (const academy of store.extraAcademies) map.set(academy.slug, structuredClone(academy));
  for (const [slug, patch] of Object.entries(store.academyOverrides)) {
    const base = map.get(slug);
    if (!base) continue;
    map.set(slug, { ...base, ...patch });
  }
  return [...map.values()];
}

function audit(
  store: StoreShape,
  entry: Omit<AuditRecord, "id" | "createdAt">,
  now: Date,
): StoreShape {
  const record: AuditRecord = {
    ...entry,
    id: `audit-${store.audit.length + 1}-${now.getTime()}`,
    createdAt: now.toISOString(),
  };
  return { ...store, audit: [record, ...store.audit].slice(0, 500) };
}

function saveMatch(store: StoreShape, match: StoredMatch): StoreShape {
  if (store.extraMatches.some((item) => item.slug === match.slug)) {
    return {
      ...store,
      extraMatches: store.extraMatches.map((item) => (item.slug === match.slug ? match : item)),
    };
  }
  if (matches.some((item) => item.slug === match.slug)) {
    return {
      ...store,
      overrides: {
        ...store.overrides,
        [match.slug]: {
          offers: match.offers,
          status: match.status,
          lastVerifiedAt: match.lastVerifiedAt,
          entryNotes: match.entryNotes,
        },
      },
    };
  }
  return { ...store, extraMatches: [...store.extraMatches, match] };
}

export function roleForEmail(email: string, allowDemoRoles: boolean): Role {
  if (!allowDemoRoles) return "fan";
  const [name, domain] = email.toLowerCase().split("@");
  if (domain !== "cricketmatch.today") return "fan";
  if (name === "admin") return "admin";
  if (name === "moderator") return "moderator";
  if (name === "academy") return "academy_owner";
  if (name === "organiser") return "organiser";
  return "fan";
}

export function requestMagicLink(
  store: StoreShape,
  input: { email: string; tokenHash: string; allowDemoRoles: boolean },
  now: Date,
): WorkflowResult<{ email: string }> {
  const email = input.email.trim().toLowerCase();
  const role = roleForEmail(email, input.allowDemoRoles);
  const next: StoreShape = {
    ...store,
    magicLinks: [
      ...store.magicLinks,
      {
        tokenHash: input.tokenHash,
        email,
        role,
        expiresAt: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
        usedAt: null,
      },
    ],
  };
  return { ok: true, store: next, emails: [], result: { email } };
}

export function consumeMagicLink(
  store: StoreShape,
  tokenHash: string,
  now: Date,
): WorkflowResult<{ email: string; role: Role; userId: string }> {
  const link = store.magicLinks.find((item) => item.tokenHash === tokenHash);
  if (!link || link.usedAt || new Date(link.expiresAt).getTime() < now.getTime()) {
    return { ok: false, errors: { form: "This sign-in link is invalid or has expired." } };
  }
  const existing = store.users.find((user) => user.email === link.email);
  const user =
    existing ??
    ({
      id: `user-${store.users.length + 1}`,
      email: link.email,
      role: link.role,
      displayName: link.email.split("@")[0] || "Fan",
      countryCode: null,
      createdAt: now.toISOString(),
    } as const);
  const next = audit(
    {
      ...store,
      users: existing ? store.users : [...store.users, user],
      magicLinks: store.magicLinks.map((item) =>
        item.tokenHash === tokenHash ? { ...item, usedAt: now.toISOString() } : item,
      ),
    },
    {
      actorEmail: user.email,
      action: "auth.sign_in",
      entityType: "user",
      entityId: user.id,
      before: null,
      after: { role: user.role },
    },
    now,
  );
  return {
    ok: true,
    store: next,
    emails: [],
    result: { email: user.email, role: user.role, userId: user.id },
  };
}

export function createMatchSubmission(
  store: StoreShape,
  input: MatchSubmissionInput,
  now: Date,
): WorkflowResult<{ id: string }> {
  const startsAt = zonedTimeToUtc(input.startsAt, input.timezone);
  const catalog = mergeMatches(store);
  const duplicates = findDuplicateCandidates(
    catalog.map((match) => ({
      id: match.slug,
      home: match.homeName,
      away: match.awayName,
      venue: match.venueName,
      competition: match.competitionName,
      startsAt: match.startsAt,
    })),
    {
      home: input.homeTeam,
      away: input.awayTeam,
      venue: input.venue,
      competition: input.competition,
      startsAt,
    },
  );
  const submission: Submission = {
    id: crypto.randomUUID(),
    entityType: "match",
    payload: {
      ...input,
      startsAtUtc: startsAt,
      duplicateSlugs: duplicates.map((item) => item.id),
    },
    submitterEmail: input.contactEmail.toLowerCase(),
    status: "pending",
    duplicateOf: null,
    reviewerEmail: null,
    reviewerNotes: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
  return {
    ok: true,
    store: { ...store, submissions: [submission, ...store.submissions] },
    emails: [],
    result: { id: submission.id },
  };
}

export function createAcademySubmission(
  store: StoreShape,
  input: AcademySubmissionInput,
  now: Date,
): WorkflowResult<{ id: string }> {
  const submission: Submission = {
    id: crypto.randomUUID(),
    entityType: "academy",
    payload: { ...input },
    submitterEmail: input.contactEmail.toLowerCase(),
    status: "pending",
    duplicateOf: null,
    reviewerEmail: null,
    reviewerNotes: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
  return {
    ok: true,
    store: { ...store, submissions: [submission, ...store.submissions] },
    emails: [],
    result: { id: submission.id },
  };
}

export function createCorrection(
  store: StoreShape,
  input: { matchSlug: string; email?: string; details: string },
  now: Date,
): WorkflowResult<{ id: string }> {
  const match = mergeMatches(store).find((item) => item.slug === input.matchSlug);
  if (!match) return { ok: false, errors: { form: "That match is no longer listed." } };
  const submission: Submission = {
    id: crypto.randomUUID(),
    entityType: "correction",
    payload: { matchSlug: input.matchSlug, details: input.details },
    submitterEmail: input.email?.toLowerCase() || null,
    status: "pending",
    duplicateOf: null,
    reviewerEmail: null,
    reviewerNotes: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
  return {
    ok: true,
    store: { ...store, submissions: [submission, ...store.submissions] },
    emails: [],
    result: { id: submission.id },
  };
}

export function createTicketRequest(
  store: StoreShape,
  input: TicketRequestInput & {
    emailHash: string;
    encryptedEmail: string;
    verifyTokenHash: string;
    unsubTokenHash: string;
  },
  now: Date,
): WorkflowResult<{ id: string; already: boolean }> {
  const match = mergeMatches(store).find((item) => item.slug === input.matchSlug && item.sourceUrl);
  if (!match || match.status === "cancelled" || match.status === "completed") {
    return { ok: false, errors: { form: "Alerts are closed for this match." } };
  }
  const existing = store.requests.find(
    (request) =>
      request.matchSlug === input.matchSlug &&
      request.emailHash === input.emailHash &&
      (request.status === "pending_verification" ||
        request.status === "active" ||
        request.status === "notified"),
  );
  if (existing) {
    return { ok: true, store, emails: [], result: { id: existing.id, already: true } };
  }
  const record = {
    id: crypto.randomUUID(),
    matchSlug: input.matchSlug,
    emailHash: input.emailHash,
    encryptedEmail: input.encryptedEmail,
    quantity: input.quantity,
    countryCode: input.countryCode,
    notes: input.notes || null,
    consentAt: now.toISOString(),
    verifiedAt: null,
    status: "pending_verification" as const,
    verifyTokenHash: input.verifyTokenHash,
    unsubTokenHash: input.unsubTokenHash,
    createdAt: now.toISOString(),
  };
  return {
    ok: true,
    store: { ...store, requests: [record, ...store.requests] },
    emails: [],
    result: { id: record.id, already: false },
  };
}

export function verifyTicketRequest(
  store: StoreShape,
  tokenHash: string,
  now: Date,
): WorkflowResult<{ matchSlug: string }> {
  const request = store.requests.find((item) => item.verifyTokenHash === tokenHash);
  if (!request) return { ok: false, errors: { form: "This confirmation link is not valid." } };
  if (request.status === "unsubscribed") {
    return { ok: false, errors: { form: "This alert was unsubscribed." } };
  }
  const match = mergeMatches(store).find((item) => item.slug === request.matchSlug);
  if (
    !match ||
    new Date(match.startsAt).getTime() <= now.getTime() ||
    match.status === "cancelled"
  ) {
    return {
      ok: false,
      store: {
        ...store,
        requests: store.requests.map((item) =>
          item.id === request.id ? { ...item, status: "expired" as const } : item,
        ),
      },
      errors: { form: "This match has started or been cancelled, so the alert was not activated." },
    };
  }
  if (request.status === "active" || request.status === "notified") {
    return { ok: true, store, emails: [], result: { matchSlug: request.matchSlug } };
  }
  const next: StoreShape = {
    ...store,
    requests: store.requests.map((item) =>
      item.id === request.id
        ? { ...item, status: "active" as const, verifiedAt: now.toISOString() }
        : item,
    ),
  };
  return { ok: true, store: next, emails: [], result: { matchSlug: request.matchSlug } };
}

export function unsubscribeTicketRequest(
  store: StoreShape,
  tokenHash: string,
  now: Date,
): WorkflowResult<{ matchSlug: string }> {
  const request = store.requests.find(
    (item) => item.unsubTokenHash === tokenHash || item.verifyTokenHash === tokenHash,
  );
  if (!request) return { ok: false, errors: { form: "This unsubscribe link is not valid." } };
  const next: StoreShape = {
    ...store,
    requests: store.requests.map((item) =>
      item.id === request.id ? { ...item, status: "unsubscribed" as const } : item,
    ),
  };
  return auditResult(
    next,
    {
      actorEmail: null,
      action: "ticket_request.unsubscribed",
      entityType: "ticket_request",
      entityId: request.id,
      before: { status: request.status },
      after: { status: "unsubscribed" },
    },
    now,
    { matchSlug: request.matchSlug },
  );
}

function auditResult<T>(
  store: StoreShape,
  entry: Omit<AuditRecord, "id" | "createdAt">,
  now: Date,
  result: T,
  emails: EmailDraft[] = [],
): WorkflowSuccess<T> {
  return { ok: true, store: audit(store, entry, now), emails, result };
}

export function reviewSubmission(
  store: StoreShape,
  input: {
    id: string;
    action: "approve" | "reject" | "changes" | "merge";
    reason?: string;
    mergeTarget?: string;
    actorEmail: string;
  },
  now: Date,
): WorkflowResult<{ id: string }> {
  const submission = store.submissions.find((item) => item.id === input.id);
  if (!submission) return { ok: false, errors: { form: "Submission not found." } };
  if (submission.status === "approved" || submission.status === "rejected") {
    return { ok: false, errors: { form: "This submission has already been closed." } };
  }
  const reason = input.reason?.trim() ?? "";
  if ((input.action === "reject" || input.action === "changes") && reason.length < 3) {
    return { ok: false, errors: { reason: "A reason is required." } };
  }
  if (input.action === "merge" && !input.mergeTarget) {
    return { ok: false, errors: { mergeTarget: "Choose the canonical match to merge into." } };
  }

  if (input.action === "reject" || input.action === "changes" || input.action === "merge") {
    const status =
      input.action === "reject"
        ? "rejected"
        : input.action === "changes"
          ? "changes_requested"
          : "approved";
    const updated: Submission = {
      ...submission,
      status,
      duplicateOf: input.action === "merge" ? input.mergeTarget || null : submission.duplicateOf,
      reviewerEmail: input.actorEmail,
      reviewerNotes: reason || null,
      updatedAt: now.toISOString(),
    };
    const next = {
      ...store,
      submissions: store.submissions.map((item) => (item.id === submission.id ? updated : item)),
    };
    return auditResult(
      next,
      {
        actorEmail: input.actorEmail,
        action: `submission.${input.action}`,
        entityType: "submission",
        entityId: submission.id,
        before: { status: submission.status },
        after: { status, reason, mergeTarget: input.mergeTarget || null },
      },
      now,
      { id: submission.id },
    );
  }

  if (submission.entityType === "match") {
    const payload = submission.payload as MatchSubmissionInput & { startsAtUtc?: string };
    if (!payload.sourceUrl) {
      return { ok: false, errors: { form: "A source URL is required before publication." } };
    }
    const catalog = mergeMatches(store);
    const taken = new Set(catalog.map((match) => match.slug));
    const slug = uniqueSlug(
      `${payload.homeTeam}-${payload.awayTeam}-${payload.city}-${String(payload.startsAt).slice(0, 10)}`,
      taken,
    );
    const countrySlug = slugify(payload.country);
    const pendingOffer: StoredOffer[] = [];
    if (payload.ticketUrl && payload.attendanceType === "ticketed") {
      const url = assertHttpsUrl(payload.ticketUrl);
      if (!url) return { ok: false, errors: { form: "The ticket URL failed the HTTPS check." } };
      const domain = url.hostname.replace(/^www\./, "");
      if (isDeniedDomain(domain, store.denyDomains)) {
        return { ok: false, errors: { form: "That ticket domain is blocked." } };
      }
      pendingOffer.push({
        id: crypto.randomUUID(),
        sellerName: payload.ticketSeller || domain,
        sellerDomain: domain,
        url: url.toString(),
        kind: "official",
        currency: null,
        priceFrom: null,
        status: "pending",
        lastCheckedAt: null,
        approved: false,
      });
    }
    const match: StoredMatch = {
      id: crypto.randomUUID(),
      slug,
      competitionName: payload.competition,
      competitionSlug: slugify(payload.competition),
      kind: payload.organiserType === "academy" ? "academy" : "domestic",
      seasonName: null,
      seasonSlug: null,
      homeName: payload.homeTeam,
      homeShort: payload.homeTeam.slice(0, 3).toUpperCase(),
      homeSlug: slugify(payload.homeTeam),
      awayName: payload.awayTeam,
      awayShort: payload.awayTeam.slice(0, 3).toUpperCase(),
      awaySlug: slugify(payload.awayTeam),
      venueName: payload.venue,
      venueSlug: slugify(payload.venue),
      venueAddress: `${payload.venue}, ${payload.city}`,
      cityName: payload.city,
      citySlug: slugify(payload.city),
      countryName: payload.country,
      countrySlug,
      startsAt: payload.startsAtUtc || new Date(payload.startsAt).toISOString(),
      endsAt: null,
      timezone: payload.timezone,
      format: payload.format,
      status: "published",
      attendanceType: payload.attendanceType,
      sourceType: payload.organiserType === "academy" ? "academy" : "organiser",
      sourceExternalId: null,
      sourceUrl: payload.sourceUrl,
      sourceLabel: "Organiser submission",
      featuredRank: 0,
      lastVerifiedAt: now.toISOString(),
      publishedAt: now.toISOString(),
      entryNotes: payload.entryNotes || null,
      demo: true,
      academySlug: null,
      offers: pendingOffer,
    };
    let next = saveMatch(store, match);
    next = {
      ...next,
      submissions: next.submissions.map((item) =>
        item.id === submission.id
          ? {
              ...item,
              status: "approved" as const,
              reviewerEmail: input.actorEmail,
              reviewerNotes: reason || null,
              updatedAt: now.toISOString(),
            }
          : item,
      ),
    };
    return auditResult(
      next,
      {
        actorEmail: input.actorEmail,
        action: "submission.approve",
        entityType: "match",
        entityId: match.id,
        before: null,
        after: { slug: match.slug, sourceUrl: match.sourceUrl },
      },
      now,
      { id: submission.id },
    );
  }

  if (submission.entityType === "academy") {
    const payload = submission.payload as AcademySubmissionInput;
    const taken = new Set(mergeAcademies(store).map((academy) => academy.slug));
    const slug = payload.claimSlug ? slugify(payload.claimSlug) : uniqueSlug(payload.name, taken);
    const academy: StoredAcademy = {
      id: crypto.randomUUID(),
      slug,
      name: payload.name,
      description: payload.description,
      address: payload.address,
      cityName: payload.city,
      citySlug: slugify(payload.city),
      countryName: payload.country,
      countrySlug: slugify(payload.country),
      website: payload.website || null,
      phone: payload.phone || null,
      contactEmail: payload.contactEmail,
      ageGroups: payload.ageGroups,
      facilities: payload.facilities,
      verificationStatus: "verified",
      verificationLabel: "Contact verified",
      lastVerifiedAt: now.toISOString(),
      ownerEmail: payload.contactEmail.toLowerCase(),
      demo: true,
    };
    const exists = mergeAcademies(store).some((item) => item.slug === slug);
    let next: StoreShape = exists
      ? {
          ...store,
          academyOverrides: { ...store.academyOverrides, [slug]: academy },
          extraAcademies: store.extraAcademies.some((item) => item.slug === slug)
            ? store.extraAcademies.map((item) => (item.slug === slug ? academy : item))
            : store.extraAcademies,
        }
      : { ...store, extraAcademies: [...store.extraAcademies, academy] };
    if (exists && store.extraAcademies.some((item) => item.slug === slug)) {
      next = {
        ...next,
        extraAcademies: store.extraAcademies.map((item) => (item.slug === slug ? academy : item)),
      };
    }
    next = {
      ...next,
      submissions: next.submissions.map((item) =>
        item.id === submission.id
          ? {
              ...item,
              status: "approved" as const,
              reviewerEmail: input.actorEmail,
              reviewerNotes: reason || null,
              updatedAt: now.toISOString(),
            }
          : item,
      ),
    };
    return auditResult(
      next,
      {
        actorEmail: input.actorEmail,
        action: "submission.approve",
        entityType: "academy",
        entityId: academy.id,
        before: null,
        after: { slug, verificationLabel: "Contact verified" },
      },
      now,
      { id: submission.id },
    );
  }

  const next = {
    ...store,
    submissions: store.submissions.map((item) =>
      item.id === submission.id
        ? {
            ...item,
            status: "approved" as const,
            reviewerEmail: input.actorEmail,
            reviewerNotes: reason || "Recorded. Fixture fields were not changed automatically.",
            updatedAt: now.toISOString(),
          }
        : item,
    ),
  };
  return auditResult(
    next,
    {
      actorEmail: input.actorEmail,
      action: "submission.approve",
      entityType: submission.entityType,
      entityId: submission.id,
      before: { status: submission.status },
      after: { status: "approved" },
    },
    now,
    { id: submission.id },
  );
}

export function approveOffer(
  store: StoreShape,
  input: { matchSlug: string; offerId: string; actorEmail: string },
  now: Date,
): WorkflowResult<{ notified: number }> {
  const match = mergeMatches(store).find((item) => item.slug === input.matchSlug);
  if (!match) return { ok: false, errors: { form: "Match not found." } };
  const offer = match.offers.find((item) => item.id === input.offerId);
  if (!offer) return { ok: false, errors: { form: "Offer not found." } };
  if (isDeniedDomain(offer.sellerDomain, store.denyDomains)) {
    return { ok: false, errors: { form: "That seller domain is blocked." } };
  }
  if (!assertHttpsUrl(offer.url)) {
    return { ok: false, errors: { form: "The offer URL is not an acceptable HTTPS link." } };
  }
  const updatedOffer: StoredOffer = {
    ...offer,
    status: "active",
    approved: true,
    lastCheckedAt: now.toISOString(),
  };
  const updatedMatch: StoredMatch = {
    ...match,
    offers: match.offers.map((item) => (item.id === offer.id ? updatedOffer : item)),
  };
  let next = saveMatch(store, updatedMatch);
  if (!next.allowDomains.includes(offer.sellerDomain)) {
    next = { ...next, allowDomains: [...next.allowDomains, offer.sellerDomain] };
  }
  const emails: EmailDraft[] = [];
  const requests = next.requests.map((request) => {
    if (request.matchSlug !== match.slug || request.status !== "active") return request;
    emails.push({
      to: request.encryptedEmail,
      subject: `Ticket alert: ${match.homeName} vs ${match.awayName}`,
      text: [
        `${match.homeName} vs ${match.awayName}`,
        `${match.venueName}, ${match.cityName}`,
        `Seller: ${updatedOffer.sellerName}`,
        `Domain: ${updatedOffer.sellerDomain}`,
        `Link: ${updatedOffer.url}`,
        "This alert does not reserve a ticket.",
        `Unsubscribe token hash is handled by the stored link.`,
      ].join("\n"),
    });
    return { ...request, status: "notified" as const };
  });
  next = { ...next, requests };
  return auditResult(
    next,
    {
      actorEmail: input.actorEmail,
      action: "ticket_offer.approve",
      entityType: "ticket_offer",
      entityId: offer.id,
      before: { status: offer.status },
      after: { status: "active", domain: offer.sellerDomain },
    },
    now,
    { notified: emails.length },
    emails,
  );
}

export function recordClick(
  store: StoreShape,
  input: { offerId: string; referrer: string | null },
  now: Date,
): WorkflowResult<{ url: string; sellerName: string; sellerDomain: string; matchSlug: string }> {
  const match = mergeMatches(store).find((item) =>
    item.offers.some((offer) => offer.id === input.offerId),
  );
  const offer = match?.offers.find((item) => item.id === input.offerId);
  if (!match || !offer || !offer.approved || offer.status !== "active") {
    return { ok: false, errors: { form: "That ticket link is not available." } };
  }
  const next: StoreShape = {
    ...store,
    clicks: [
      {
        id: `click-${store.clicks.length + 1}`,
        matchSlug: match.slug,
        offerId: offer.id,
        referrer: input.referrer,
        createdAt: now.toISOString(),
      },
      ...store.clicks,
    ],
  };
  return {
    ok: true,
    store: next,
    emails: [],
    result: {
      url: offer.url,
      sellerName: offer.sellerName,
      sellerDomain: offer.sellerDomain,
      matchSlug: match.slug,
    },
  };
}

export function expireDue(store: StoreShape, now: Date): StoreShape {
  const current = mergeMatches(store);
  let next = store;
  for (const match of current) {
    if (new Date(match.startsAt).getTime() > now.getTime()) continue;
    const offers = match.offers.map((offer) =>
      offer.status === "active" || offer.status === "pending"
        ? { ...offer, status: "expired" as const }
        : offer,
    );
    if (offers.some((offer, index) => offer.status !== match.offers[index]?.status)) {
      next = saveMatch(next, { ...match, offers });
    }
  }
  next = {
    ...next,
    requests: next.requests.map((request) => {
      const match = mergeMatches(next).find((item) => item.slug === request.matchSlug);
      if (!match) return request;
      if (
        (request.status === "active" || request.status === "pending_verification") &&
        (match.status === "cancelled" || new Date(match.startsAt).getTime() <= now.getTime())
      ) {
        return { ...request, status: "expired" as const };
      }
      return request;
    }),
  };
  return next;
}

export function markVerified(
  store: StoreShape,
  input: { matchSlug: string; actorEmail: string },
  now: Date,
): WorkflowResult<{ slug: string }> {
  const match = mergeMatches(store).find((item) => item.slug === input.matchSlug);
  if (!match) return { ok: false, errors: { form: "Match not found." } };
  const next = saveMatch(store, { ...match, lastVerifiedAt: now.toISOString() });
  return auditResult(
    next,
    {
      actorEmail: input.actorEmail,
      action: "match.verify",
      entityType: "match",
      entityId: match.id,
      before: { lastVerifiedAt: match.lastVerifiedAt },
      after: { lastVerifiedAt: now.toISOString() },
    },
    now,
    { slug: match.slug },
  );
}

/** Turn a provider row into a catalog match. Ticket offers are never attached here. */
export function materializeProviderMatch(
  match: NormalizedMatch,
  taken: Set<string>,
  now: Date,
): StoredMatch {
  const dateKey = match.startsAt.slice(0, 10);
  const slug = uniqueSlug(`${match.home} vs ${match.away} ${match.venue} ${dateKey}`, taken);
  taken.add(slug);
  const hasSource = Boolean(match.sourceUrl);
  const status = hasSource ? match.status : match.status === "published" ? "pending" : match.status;
  return {
    id: crypto.randomUUID(),
    slug,
    competitionName: match.competition,
    competitionSlug: slugify(match.competition),
    kind: "domestic",
    seasonName: null,
    seasonSlug: null,
    homeName: match.home,
    homeShort: match.home.slice(0, 3).toUpperCase(),
    homeSlug: slugify(match.home),
    awayName: match.away,
    awayShort: match.away.slice(0, 3).toUpperCase(),
    awaySlug: slugify(match.away),
    venueName: match.venue,
    venueSlug: slugify(match.venue),
    venueAddress: `${match.venue}, ${match.city}`,
    cityName: match.city,
    citySlug: slugify(match.city),
    countryName: match.country,
    countrySlug: slugify(match.country),
    startsAt: match.startsAt,
    endsAt: null,
    timezone: match.timezone || "UTC",
    format: match.format,
    status,
    attendanceType: "unknown",
    sourceType: "api",
    sourceExternalId: match.externalId,
    sourceUrl: match.sourceUrl,
    sourceLabel: match.provider === "sportmonks" ? "SportMonks" : "Provider",
    featuredRank: 0,
    lastVerifiedAt: now.toISOString(),
    publishedAt: hasSource && status !== "draft" && status !== "pending" ? now.toISOString() : null,
    entryNotes: null,
    demo: false,
    academySlug: null,
    offers: [],
  };
}

/**
 * Apply provider inserts and schedule updates.
 * Organiser and academy rows are never overwritten. New rows start with no ticket offers.
 */
export function applyImportPlan(
  store: StoreShape,
  plan: {
    inserts: NormalizedMatch[];
    updates: Array<{ id: string; match: NormalizedMatch }>;
  },
  now: Date,
): { store: StoreShape; inserted: number; updated: number } {
  let next = store;
  const taken = new Set(mergeMatches(next).map((item) => item.slug));
  let inserted = 0;
  let updated = 0;

  for (const incoming of plan.inserts) {
    const created = materializeProviderMatch(incoming, taken, now);
    next = { ...next, extraMatches: [...next.extraMatches, created] };
    inserted += 1;
  }

  for (const update of plan.updates) {
    const current = mergeMatches(next).find((item) => item.id === update.id);
    if (!current || current.sourceType === "organiser" || current.sourceType === "academy")
      continue;
    const patch: Partial<StoredMatch> = {
      startsAt: update.match.startsAt,
      status: update.match.status,
      venueName: update.match.venue,
      venueSlug: slugify(update.match.venue),
      cityName: update.match.city,
      citySlug: slugify(update.match.city),
      countryName: update.match.country,
      countrySlug: slugify(update.match.country),
      format: update.match.format,
      sourceExternalId: update.match.externalId,
      lastVerifiedAt: now.toISOString(),
      timezone: update.match.timezone || current.timezone,
    };
    if (next.extraMatches.some((item) => item.slug === current.slug)) {
      next = {
        ...next,
        extraMatches: next.extraMatches.map((item) =>
          item.slug === current.slug ? { ...item, ...patch } : item,
        ),
      };
    } else {
      next = {
        ...next,
        overrides: {
          ...next.overrides,
          [current.slug]: { ...next.overrides[current.slug], ...patch },
        },
      };
    }
    updated += 1;
  }

  return { store: next, inserted, updated };
}

export function assignRole(
  store: StoreShape,
  input: { actorEmail: string; actorRole: Role; account: string; role: Role },
  now: Date,
): WorkflowResult<{ email: string }> {
  if (input.actorRole !== "admin")
    return { ok: false, errors: { form: "Admin access is required." } };
  const account = input.account.trim();
  const user = store.users.find(
    (item) => item.id === account || item.email === account.toLowerCase(),
  );
  if (!user) return { ok: false, errors: { form: "That person has not signed in yet." } };
  if (user.email === input.actorEmail.toLowerCase())
    return { ok: false, errors: { form: "Choose another account." } };
  const next = {
    ...store,
    users: store.users.map((item) => (item.id === user.id ? { ...item, role: input.role } : item)),
  };
  return auditResult(
    next,
    {
      actorEmail: input.actorEmail,
      action: "profile.role",
      entityType: "user",
      entityId: user.id,
      before: { role: user.role },
      after: { role: input.role },
    },
    now,
    { email: user.email },
  );
}

export function appendOutbox(store: StoreShape, emails: EmailDraft[], now: Date): StoreShape {
  if (emails.length === 0) return store;
  const messages: OutboxMessage[] = emails.map((email, index) => ({
    id: `mail-${store.outbox.length + index + 1}`,
    to: email.to,
    subject: email.subject,
    text: email.text,
    createdAt: now.toISOString(),
  }));
  return { ...store, outbox: [...messages, ...store.outbox] };
}
