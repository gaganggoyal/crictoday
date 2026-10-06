import { describe, expect, it } from "vitest";
import { matches } from "@/lib/data/seed";
import type { NormalizedMatch } from "@/lib/domain/providers";
import type { StoredMatch, TicketRequestRecord } from "@/lib/domain/types";
import { encryptString, decryptString, signPayload, verifyPayload } from "@/lib/security/crypto";
import {
  applyImportPlan,
  approveOffer,
  assignRole,
  createTicketRequest,
  emptyStore,
  expireDue,
  mergeMatches,
  reviewSubmission,
  unsubscribeTicketRequest,
  verifyTicketRequest,
} from "@/lib/domain/workflows";

const now = new Date("2026-10-04T12:00:00.000Z");

function request(patch: Partial<TicketRequestRecord> = {}): TicketRequestRecord {
  return {
    id: "req-1",
    matchSlug: "india-vs-australia-2nd-test-delhi-2026-10-24",
    emailHash: "hash-1",
    encryptedEmail: "cipher-text",
    quantity: 2,
    countryCode: "IN",
    notes: null,
    consentAt: now.toISOString(),
    verifiedAt: null,
    status: "pending_verification",
    verifyTokenHash: "verify-hash",
    unsubTokenHash: "unsub-hash",
    createdAt: now.toISOString(),
    ...patch,
  };
}

describe("ticket request workflow", () => {
  it("dedupes, verifies, unsubscribes, and expires a started match", () => {
    const first = createTicketRequest(
      emptyStore(),
      {
        matchSlug: "india-vs-australia-2nd-test-delhi-2026-10-24",
        email: "fan@example.com",
        quantity: 2,
        countryCode: "IN",
        notes: "",
        consent: true,
        emailHash: "hash-1",
        encryptedEmail: "cipher-text",
        verifyTokenHash: "verify-hash",
        unsubTokenHash: "unsub-hash",
      },
      now,
    );
    expect(first.ok && first.result.already).toBe(false);
    const second = createTicketRequest(
      first.ok ? first.store : emptyStore(),
      {
        matchSlug: "india-vs-australia-2nd-test-delhi-2026-10-24",
        email: "fan@example.com",
        quantity: 2,
        countryCode: "IN",
        notes: "",
        consent: true,
        emailHash: "hash-1",
        encryptedEmail: "cipher-text",
        verifyTokenHash: "other",
        unsubTokenHash: "other",
      },
      now,
    );
    // Not confirmed yet: asking again replaces the links so the email can go out again.
    expect(second.ok && second.result).toEqual({
      id: first.ok ? first.result.id : "",
      already: false,
    });
    expect(second.ok && second.store.requests).toHaveLength(1);
    expect(second.ok && second.store.requests[0]?.verifyTokenHash).toBe("other");

    const verified = verifyTicketRequest(first.ok ? first.store : emptyStore(), "verify-hash", now);
    expect(verified.ok).toBe(true);
    if (!verified.ok) return;
    expect(verified.store.requests[0]?.status).toBe("active");

    const removed = unsubscribeTicketRequest(verified.store, "unsub-hash", now);
    expect(removed.ok).toBe(true);
    if (!removed.ok) return;
    expect(removed.store.requests[0]?.status).toBe("unsubscribed");

    const started = verifyTicketRequest(
      { ...emptyStore(), requests: [request({ status: "pending_verification" })] },
      "verify-hash",
      new Date("2026-10-25T00:00:00.000Z"),
    );
    expect(started.ok).toBe(false);
    if (started.ok) return;
    expect(started.store?.requests[0]?.status).toBe("expired");
  });

  it("emails an active alert only after the offer is approved", () => {
    const base = matches.find(
      (match) => match.slug === "india-vs-australia-2nd-test-delhi-2026-10-24",
    );
    expect(base).toBeTruthy();
    const pending = {
      id: "pending-offer",
      sellerName: "Board",
      sellerDomain: "tickets.example.com",
      url: "https://tickets.example.com/delhi",
      kind: "official" as const,
      currency: null,
      priceFrom: null,
      status: "pending" as const,
      lastCheckedAt: null,
      approved: false,
    };
    const store = {
      ...emptyStore(),
      extraMatches: [{ ...base!, offers: [pending] }],
      requests: [
        request({ status: "active" }),
        request({ id: "req-2", status: "pending_verification", emailHash: "hash-2" }),
      ],
    };
    const approved = approveOffer(
      store,
      { matchSlug: base!.slug, offerId: pending.id, actorEmail: "moderator@cricketmatch.today" },
      now,
    );
    expect(approved.ok).toBe(true);
    if (!approved.ok) return;
    expect(approved.result.notified).toBe(1);
    expect(approved.emails[0]?.to).toBe("cipher-text");
    expect(approved.emails[0]?.to.includes("@")).toBe(false);
    // Same body as approve_ticket_offer in the Supabase migration.
    expect(approved.emails[0]?.text.split("\n")).toEqual([
      "India vs Australia",
      "Arun Jaitley Stadium, Delhi",
      "Seller: Board",
      "Domain: tickets.example.com",
      "Link: https://tickets.example.com/delhi",
      "This alert does not reserve a ticket.",
    ]);
    const visible = mergeMatches(approved.store).find((match) => match.slug === base!.slug);
    expect(visible?.offers[0]?.approved).toBe(true);
    expect(visible?.offers[0]?.status).toBe("active");
    expect(approved.store.allowDomains).toContain("tickets.example.com");
  });

  it("refuses to publish a match submission that has no source", () => {
    const id = "66666666-6666-4666-8666-666666666666";
    const result = reviewSubmission(
      {
        ...emptyStore(),
        submissions: [
          {
            id,
            entityType: "match",
            payload: { homeTeam: "North", awayTeam: "South" },
            submitterEmail: "club@example.com",
            status: "pending",
            duplicateOf: null,
            reviewerEmail: null,
            reviewerNotes: null,
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
          },
        ],
      },
      { id, action: "approve", actorEmail: "moderator@cricketmatch.today" },
      now,
    );
    expect(result.ok).toBe(false);
  });
});

describe("import application", () => {
  it("inserts a sourced provider fixture and updates an api row without touching organiser rows", () => {
    const incoming: NormalizedMatch = {
      externalId: "sportmonks:77",
      provider: "sportmonks",
      competition: "Tour",
      home: "Essex",
      away: "Kent",
      startsAt: "2026-11-02T11:00:00.000Z",
      timezone: "Europe/London",
      venue: "County Ground",
      city: "Chelmsford",
      country: "England",
      format: "t20",
      status: "published",
      sourceUrl: "https://www.sportmonks.com/",
    };
    const inserted = applyImportPlan(emptyStore(), { inserts: [incoming], updates: [] }, now);
    expect(inserted.inserted).toBe(1);
    const created = inserted.store.extraMatches[0];
    expect(created?.sourceUrl).toBe("https://www.sportmonks.com/");
    expect(created?.offers).toEqual([]);
    expect(created?.demo).toBe(false);

    const organiser: StoredMatch = {
      ...created!,
      sourceType: "organiser",
      sourceExternalId: "sportmonks:88",
    };
    const api: StoredMatch = {
      ...created!,
      id: "api-row",
      slug: "api-row",
      sourceExternalId: "sportmonks:89",
    };
    const next = applyImportPlan(
      { ...emptyStore(), extraMatches: [organiser, api] },
      {
        inserts: [],
        updates: [
          { id: organiser.id, match: { ...incoming, startsAt: "2026-11-03T11:00:00.000Z" } },
          {
            id: api.id,
            match: {
              ...incoming,
              externalId: "sportmonks:89",
              startsAt: "2026-11-04T11:00:00.000Z",
            },
          },
        ],
      },
      now,
    );
    expect(next.updated).toBe(1);
    expect(next.store.extraMatches.find((match) => match.id === organiser.id)?.startsAt).toBe(
      organiser.startsAt,
    );
    expect(next.store.extraMatches.find((match) => match.id === api.id)?.startsAt).toBe(
      "2026-11-04T11:00:00.000Z",
    );
  });

  it("expires an active offer and an open alert once the match has started", () => {
    const base = matches[0];
    const store = {
      ...emptyStore(),
      extraMatches: [
        {
          ...base,
          slug: "already-started",
          startsAt: "2026-10-01T00:00:00.000Z",
          offers: [
            {
              id: "live-offer",
              sellerName: "Board",
              sellerDomain: "tickets.example.com",
              url: "https://tickets.example.com/old",
              kind: "official" as const,
              currency: null,
              priceFrom: null,
              status: "active" as const,
              lastCheckedAt: now.toISOString(),
              approved: true,
            },
          ],
        },
      ],
      requests: [request({ matchSlug: "already-started", status: "active" })],
    };
    const expired = expireDue(store, now);
    expect(
      mergeMatches(expired).find((match) => match.slug === "already-started")?.offers[0]?.status,
    ).toBe("expired");
    expect(expired.requests[0]?.status).toBe("expired");
  });
});

describe("roles", () => {
  it("lets an admin change another account and refuses a fan or a self change", () => {
    const store = {
      ...emptyStore(),
      users: [
        {
          id: "user-1",
          email: "admin@cricketmatch.today",
          role: "admin" as const,
          displayName: "Admin",
          countryCode: null,
          createdAt: now.toISOString(),
        },
        {
          id: "user-2",
          email: "fan@example.com",
          role: "fan" as const,
          displayName: "Fan",
          countryCode: null,
          createdAt: now.toISOString(),
        },
      ],
    };
    const denied = assignRole(
      store,
      {
        actorEmail: "fan@example.com",
        actorRole: "fan",
        account: "admin@cricketmatch.today",
        role: "admin",
      },
      now,
    );
    expect(denied.ok).toBe(false);
    const self = assignRole(
      store,
      {
        actorEmail: "admin@cricketmatch.today",
        actorRole: "admin",
        account: "admin@cricketmatch.today",
        role: "fan",
      },
      now,
    );
    expect(self.ok).toBe(false);
    const changed = assignRole(
      store,
      {
        actorEmail: "admin@cricketmatch.today",
        actorRole: "admin",
        account: "fan@example.com",
        role: "moderator",
      },
      now,
    );
    expect(changed.ok).toBe(true);
    if (!changed.ok) return;
    expect(changed.store.users.find((user) => user.email === "fan@example.com")?.role).toBe(
      "moderator",
    );
  });
});

describe("crypto", () => {
  it("round-trips a secret and rejects a bad signature", () => {
    const sealed = encryptString("fan@example.com");
    expect(decryptString(sealed)).toBe("fan@example.com");
    const signature = signPayload("session-body");
    expect(verifyPayload("session-body", signature)).toBe(true);
    expect(verifyPayload("session-body", `${signature}x`)).toBe(false);
  });
});
