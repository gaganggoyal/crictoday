import { z } from "zod";
import { normalizeName } from "@/lib/domain/duplicates";
import { TIMEZONES } from "@/lib/domain/labels";
import { assertHttpsUrl } from "@/lib/domain/urls";

const optionalText = z.string().trim().max(500).optional().or(z.literal(""));

export const matchSubmissionSchema = z
  .object({
    organiserType: z.enum(["board", "league", "club", "academy", "venue"]),
    contactEmail: z.string().trim().email("Enter a valid contact email."),
    competition: z.string().trim().min(2, "Enter the competition name.").max(120),
    homeTeam: z.string().trim().min(2, "Enter the home side.").max(80),
    awayTeam: z.string().trim().min(2, "Enter the away side.").max(80),
    startsAt: z.string().min(1, "Enter the start date and time."),
    timezone: z.enum(TIMEZONES as [string, ...string[]], { error: "Choose a timezone." }),
    venue: z.string().trim().min(2, "Enter the venue.").max(120),
    city: z.string().trim().min(2, "Enter the city.").max(80),
    country: z.string().trim().min(2, "Enter the country.").max(80),
    format: z.enum(["test", "odi", "t20", "t10", "hundred", "other"]),
    attendanceType: z.enum(["ticketed", "free", "private", "unknown"]),
    sourceUrl: z
      .string()
      .trim()
      .url("Enter a valid source URL.")
      .refine((value) => value.startsWith("https://"), "Source URL must start with https://."),
    ticketUrl: optionalText,
    ticketSeller: z.string().trim().max(80).optional().or(z.literal("")),
    entryNotes: z.string().trim().max(500).optional().or(z.literal("")),
    consent: z.preprocess(
    (value) => value === true || value === "true" || value === "on",
    z.literal(true, { error: "Confirm you are allowed to submit this fixture." }),
  ),
    companyWebsite: z.string().optional(),
  })
  .superRefine((value, context) => {
    if (normalizeName(value.homeTeam) === normalizeName(value.awayTeam)) {
      context.addIssue({
        code: "custom",
        path: ["awayTeam"],
        message: "Home and away sides must be different.",
      });
    }
    if (Number.isNaN(new Date(value.startsAt).getTime())) {
      context.addIssue({
        code: "custom",
        path: ["startsAt"],
        message: "Enter a valid start date and time.",
      });
    }
    if (value.ticketUrl && !assertHttpsUrl(value.ticketUrl)) {
      context.addIssue({
        code: "custom",
        path: ["ticketUrl"],
        message: "Ticket URL must be HTTPS and cannot be a link shortener.",
      });
    }
  });

export const academySubmissionSchema = z.object({
  name: z.string().trim().min(2, "Enter the academy name.").max(120),
  address: z.string().trim().min(4, "Enter the street address.").max(180),
  city: z.string().trim().min(2, "Enter the city.").max(80),
  country: z.string().trim().min(2, "Enter the country.").max(80),
  contactEmail: z.string().trim().email("Enter a valid contact email."),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  website: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .refine((value) => !value || Boolean(assertHttpsUrl(value)), "Website must be an HTTPS URL."),
  ageGroups: z.array(z.string().trim().min(1)).min(1, "Select at least one age group."),
  facilities: z.array(z.string().trim().min(1)).min(1, "Select at least one facility."),
  description: z.string().trim().min(20, "Describe the academy in at least 20 characters.").max(800),
  evidence: z.string().trim().min(10, "Add a short note about how you can prove ownership.").max(500),
  claimSlug: z.string().trim().optional().or(z.literal("")),
  consent: z.preprocess(
    (value) => value === true || value === "true" || value === "on",
    z.literal(true, { error: "Confirm the contact details are yours to publish." }),
  ),
  companyWebsite: z.string().optional(),
});

export const ticketRequestSchema = z.object({
  matchSlug: z.string().trim().min(1),
  email: z.string().trim().email("Enter a valid email address."),
  quantity: z.coerce
    .number()
    .int("Enter a whole number.")
    .min(1, "Quantity must be at least 1.")
    .max(10, "Quantity cannot be more than 10."),
  countryCode: z.string().trim().min(2, "Enter your country.").max(56),
  notes: z.string().trim().max(240).optional().or(z.literal("")),
  consent: z.preprocess(
    (value) => value === true || value === "true" || value === "on",
    z.literal(true, { error: "Consent is required. A request does not reserve a ticket." }),
  ),
  companyWebsite: z.string().optional(),
});

export const correctionSchema = z.object({
  matchSlug: z.string().trim().min(1),
  email: z.string().trim().email("Enter a valid email.").optional().or(z.literal("")),
  details: z.string().trim().min(12, "Describe what is wrong, including the correct detail.").max(800),
  companyWebsite: z.string().optional(),
});

export const magicLinkSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  companyWebsite: z.string().optional(),
  next: z.string().optional(),
});

export const reviewSchema = z.object({
  id: z.string().uuid("Choose a submission."),
  action: z.enum(["approve", "reject", "changes", "merge"]),
  reason: z.string().trim().max(500).optional().or(z.literal("")),
  mergeTarget: z.string().trim().optional().or(z.literal("")),
});

export function zodErrors(error: z.ZodError) {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}

export type MatchSubmissionInput = z.infer<typeof matchSubmissionSchema>;
export type AcademySubmissionInput = z.infer<typeof academySubmissionSchema>;
export type TicketRequestInput = z.infer<typeof ticketRequestSchema>;
