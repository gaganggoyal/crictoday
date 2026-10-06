import { z } from "zod";
import { indiaState } from "@/lib/data/india";
import { normalizeName } from "@/lib/domain/duplicates";
import { MAX_CAPTION } from "@/lib/domain/media";
import { MAX_SHEET_CELL, MAX_SHEET_COLUMNS, MAX_SHEET_ROWS } from "@/lib/domain/schedule";
import { OFFERING_CATEGORIES, PROFILE_KINDS } from "@/lib/domain/profiles";
import type { OfferingCategory, ProfileKind } from "@/lib/domain/types";
import { assertHttpsUrl } from "@/lib/domain/urls";

const optional = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

/** Collapses line breaks and runs of spaces, for text shown on one line or in an email subject. */
const oneLine = (value: string) => value.replace(/\s+/g, " ");

/** Required one-line text. */
const line = (min: number, max: number, message: string) =>
  z.string().trim().min(min, message).max(max).transform(oneLine);

/** Optional one-line text. */
const optionalLine = (max: number) =>
  z.string().trim().max(max).transform(oneLine).optional().or(z.literal(""));

const phone = z
  .string()
  .trim()
  .max(30)
  .refine(
    (value) => !value || /^\+?[\d][\d\s()-]{5,}$/.test(value),
    "Enter the number with its country code, like +91 98765 43210.",
  )
  .optional()
  .or(z.literal(""));

const link = (message: string) =>
  z
    .string()
    .trim()
    .max(300)
    .refine((value) => !value || Boolean(assertHttpsUrl(value)), message)
    .optional()
    .or(z.literal(""));

const social = (host: string, label: string) =>
  z
    .string()
    .trim()
    .max(300)
    .refine((value) => {
      if (!value) return true;
      const url = assertHttpsUrl(value);
      const name = url?.hostname.replace(/^(www|m)\./, "").toLowerCase();
      return Boolean(name && (name === host || name.endsWith(`.${host}`)));
    }, `Paste your ${label} page address, starting https://${host}/`)
    .optional()
    .or(z.literal(""));

const checked = (message: string) =>
  z.preprocess(
    (value) => value === true || value === "true" || value === "on",
    z.literal(true, { error: message }),
  );

export const profileSchema = z
  .object({
    kind: z.enum(PROFILE_KINDS as [ProfileKind, ...ProfileKind[]], {
      error: "Choose what you run.",
    }),
    name: line(3, 120, "Enter the name people know you by."),
    description: z
      .string()
      .trim()
      .min(30, "Tell people what you do, in at least 30 characters.")
      .max(1500),
    country: z.string().trim().min(2, "Choose a country."),
    state: optional(120),
    city: line(2, 80, "Enter your town or city."),
    address: line(4, 200, "Enter your ground or street address."),
    timezone: optional(64),
    contactEmail: z.string().trim().email("Enter a valid email."),
    phone,
    whatsapp: phone,
    website: link("Website must be a full https address."),
    instagram: social("instagram.com", "Instagram"),
    facebook: social("facebook.com", "Facebook"),
    youtube: social("youtube.com", "YouTube"),
    ageGroups: z.array(z.string().trim().min(1).max(20)).max(12).default([]),
    facilities: z.array(z.string().trim().min(1).max(30)).max(15).default([]),
    consent: checked("Confirm you run it or are allowed to list it."),
    companyWebsite: z.string().optional(),
  })
  // Runs even when other fields failed, so every missing answer is reported at once.
  .superRefine(
    (value, context) => {
      if (value.country === "india" && !indiaState(value.state)) {
        context.addIssue({ code: "custom", path: ["state"], message: "Choose your state." });
      }
    },
    { when: () => true },
  );

export const offeringSchema = z.object({
  profile: z.string().trim().min(1),
  id: optional(64),
  category: z.enum(OFFERING_CATEGORIES as [OfferingCategory, ...OfferingCategory[]], {
    error: "Choose what kind of offer this is.",
  }),
  title: line(3, 80, "Name the offer, like U14 coaching."),
  price: optionalLine(60),
  schedule: optionalLine(80),
  details: optional(500),
  url: link("Booking link must be a full https address."),
});

export const captionSchema = z.object({
  profile: z.string().trim().min(1),
  id: z.string().regex(/^[0-9a-f]{32}$/, "That photo was removed."),
  caption: optionalLine(MAX_CAPTION).transform((value) => value ?? ""),
});

/** A spreadsheet's cells as the browser read them, sent as JSON. */
export const scheduleSheetSchema = z.object({
  profile: z.string().trim().min(1),
  rows: z
    .string()
    .max(4_000_000)
    .transform((text, context) => {
      try {
        return JSON.parse(text) as unknown;
      } catch {
        context.addIssue({ code: "custom", message: "That sheet could not be read." });
        return z.NEVER;
      }
    })
    .pipe(
      z.array(z.array(z.string().max(MAX_SHEET_CELL)).max(MAX_SHEET_COLUMNS)).max(MAX_SHEET_ROWS),
    ),
  date1904: z.preprocess((value) => value === "1", z.boolean()),
});

/** Formats a club can choose, in the words local organisers use. */
export const OWNER_FORMATS = ["t20", "odi", "t10", "test", "other"] as const;
export const OWNER_FORMAT_LABEL: Record<(typeof OWNER_FORMATS)[number], string> = {
  t20: "T20",
  odi: "One-day",
  t10: "T10",
  test: "Multi-day",
  other: "Other, such as box or tennis-ball cricket",
};

export const ownerMatchSchema = z
  .object({
    profile: z.string().trim().min(1),
    match: optional(160),
    competition: optionalLine(120),
    homeTeam: line(2, 80, "Enter the home side."),
    awayTeam: line(2, 80, "Enter the away side."),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the date."),
    time: z.string().regex(/^\d{2}:\d{2}$/, "Choose the start time."),
    ground: line(2, 120, "Enter the ground."),
    state: optional(120),
    city: line(2, 80, "Enter the town or city."),
    format: z.enum(OWNER_FORMATS, { error: "Choose the format." }),
    attendance: z.enum(["free", "ticketed", "private"], { error: "Choose how people get in." }),
    entryNotes: optional(300),
    ticketUrl: link("Ticket link must be a full https address."),
    status: z.enum(["published", "postponed", "cancelled"]).default("published"),
  })
  .superRefine(
    (value, context) => {
      const { homeTeam, awayTeam } = value as { homeTeam?: unknown; awayTeam?: unknown };
      if (typeof homeTeam !== "string" || typeof awayTeam !== "string") return;
      if (normalizeName(homeTeam) === normalizeName(awayTeam)) {
        context.addIssue({
          code: "custom",
          path: ["awayTeam"],
          message: "Home and away sides must be different.",
        });
      }
    },
    { when: () => true },
  );

export type ProfileInput = z.infer<typeof profileSchema>;
export type OfferingInput = z.infer<typeof offeringSchema>;
export type OwnerMatchInput = z.infer<typeof ownerMatchSchema>;
