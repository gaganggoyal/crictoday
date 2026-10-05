"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { safeNextPath, siteUrl } from "@/lib/utils";
import { supabaseServer } from "@/lib/auth/supabase-server";
import { consumeDemoSignIn } from "@/lib/auth/demo-signin";
import { clearSession, getSession, isStaff, setSession } from "@/lib/auth/session";
import { readStore, writeStore } from "@/lib/data/store";
import { dataMode, demoRolesAllowed } from "@/lib/data/mode";
import {
  serviceApproveOffer,
  serviceAssignRole,
  serviceCreateSubmission,
  serviceCreateTicketRequest,
  serviceMarkVerified,
  serviceOpenTicketRequest,
  serviceReview,
} from "@/lib/data/service-writes";
import { emailService } from "@/lib/email/service";
import {
  decryptString,
  encryptString,
  hashEmail,
  hashToken,
  newToken,
} from "@/lib/security/crypto";
import { limitHit } from "@/lib/security/limit";
import {
  academySubmissionSchema,
  correctionSchema,
  magicLinkSchema,
  matchSubmissionSchema,
  reviewSchema,
  ticketRequestSchema,
  zodErrors,
} from "@/lib/validation/schemas";
import { zonedTimeToUtc } from "@/lib/domain/time";
import type { Role } from "@/lib/domain/types";
import {
  appendOutbox,
  approveOffer,
  assignRole,
  createAcademySubmission,
  createCorrection,
  createMatchSubmission,
  createTicketRequest,
  markVerified,
  requestMagicLink,
  reviewSubmission,
  verifyTicketRequest,
  unsubscribeTicketRequest,
  type EmailDraft,
  type WorkflowResult,
} from "@/lib/domain/workflows";
import { track } from "@/lib/analytics/track";

const ROLES: Role[] = ["fan", "academy_owner", "organiser", "moderator", "admin"];

async function clientKey(scope: string) {
  const headerStore = await headers();
  const ip = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  return `${scope}:${ip}`;
}

function honeypot(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function commit<T>(result: WorkflowResult<T>) {
  if (result.ok) writeStore(appendOutbox(result.store, result.emails, new Date()));
  else if (result.store) writeStore(result.store);
  return result;
}

function failure(errors: Record<string, string>) {
  return { ok: false as const, errors };
}

function requireWritable() {
  if (dataMode() === "unconfigured") {
    return failure({
      form: "This action needs a database. Connect Supabase before production use.",
    });
  }
  return null;
}

async function gate(scope: string, limit: number, windowMs: number, tooMany: string) {
  const result = await limitHit(await clientKey(scope), limit, windowMs);
  if (result.unavailable) {
    return failure({
      form: "This action is paused because the shared rate limit store is unavailable.",
    });
  }
  if (!result.ok) return failure({ form: tooMany });
  return null;
}

async function deliver(emails: EmailDraft[]) {
  const service = emailService();
  for (const email of emails) {
    const to = email.to.includes("@") ? email.to : decryptString(email.to);
    await service.send({ ...email, to });
  }
}

function readForm(formData: FormData) {
  const raw: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value !== "string") continue;
    if (key === "ageGroups" || key === "facilities") {
      const list = Array.isArray(raw[key]) ? (raw[key] as string[]) : [];
      list.push(value);
      raw[key] = list;
    } else {
      raw[key] = value;
    }
  }
  if (raw.consent === "on" || raw.consent === "true") raw.consent = true;
  if (!raw.ageGroups) raw.ageGroups = [];
  if (!raw.facilities) raw.facilities = [];
  return raw;
}

function withoutHoneypot<T extends { companyWebsite?: string }>(data: T) {
  return Object.fromEntries(
    Object.entries(data).filter(([key]) => key !== "companyWebsite"),
  ) as Omit<T, "companyWebsite">;
}

export async function requestMagicLinkAction(_state: unknown, formData: FormData) {
  const parsed = magicLinkSchema.safeParse(readForm(formData));
  if (!parsed.success) return failure(zodErrors(parsed.error));
  if (honeypot(parsed.data.companyWebsite)) return { ok: true as const, demo: false };
  const limited = await gate(
    `auth:${parsed.data.email}`,
    5,
    60 * 60 * 1000,
    "Too many sign-in attempts. Try again later.",
  );
  if (limited) return limited;
  const blocked = requireWritable();
  if (blocked) return blocked;

  if (dataMode() === "supabase") {
    const supabase = await supabaseServer();
    if (!supabase) return failure({ form: "Sign-in is not configured." });
    const next = safeNextPath(parsed.data.next);
    const jar = await cookies();
    jar.set("cm_next", next, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 30 * 60,
    });
    const { error } = await supabase.auth.signInWithOtp({
      email: parsed.data.email,
      options: { emailRedirectTo: `${siteUrl()}/auth/callback` },
    });
    if (error) return failure({ form: "We could not send a sign-in link. Try again later." });
    redirect("/login/sent");
  }

  const token = newToken();
  const next = safeNextPath(parsed.data.next);
  const now = new Date();
  const result = commit(
    requestMagicLink(
      readStore(),
      { email: parsed.data.email, tokenHash: hashToken(token), allowDemoRoles: demoRolesAllowed() },
      now,
    ),
  );
  if (!result.ok) return failure(result.errors);
  const link = `${siteUrl()}/login/verify?token=${token}&next=${encodeURIComponent(next)}`;
  await emailService().send({
    to: parsed.data.email,
    subject: "Your cricketmatch.today sign-in link",
    text: `Sign in: ${link}\nThis link expires in 30 minutes.`,
  });
  if (demoRolesAllowed()) {
    redirect(
      `/login/sent?email=${encodeURIComponent(parsed.data.email)}&token=${token}&next=${encodeURIComponent(next)}`,
    );
  }
  redirect("/login/sent");
}

export async function verifyMagicLinkAction(token: string) {
  const result = consumeDemoSignIn(token);
  if (!result.ok) return failure(result.errors);
  await setSession({
    userId: result.result.userId,
    email: result.result.email,
    role: result.result.role,
  });
  return result;
}

export async function signOutAction() {
  if (dataMode() === "supabase") {
    const supabase = await supabaseServer();
    await supabase?.auth.signOut();
  }
  await clearSession();
  redirect("/");
}

export async function submitMatchAction(_state: unknown, formData: FormData) {
  const parsed = matchSubmissionSchema.safeParse(readForm(formData));
  if (!parsed.success) return failure(zodErrors(parsed.error));
  if (honeypot(parsed.data.companyWebsite)) return { ok: true as const, id: "ignored" };
  const limited = await gate(
    `match:${parsed.data.contactEmail}`,
    8,
    60 * 60 * 1000,
    "Too many submissions. Try again in an hour.",
  );
  if (limited) return limited;
  const blocked = requireWritable();
  if (blocked) return blocked;
  if (dataMode() === "supabase") {
    const session = await getSession();
    const result = await serviceCreateSubmission({
      entityType: "match",
      submitterId: session?.userId ?? null,
      payload: {
        ...withoutHoneypot(parsed.data),
        startsAtUtc: zonedTimeToUtc(parsed.data.startsAt, parsed.data.timezone),
      },
    });
    if (!result.ok) return result;
    await track("submission_completed", { entity: "match" });
    revalidatePath("/admin/submissions");
    return { ok: true as const, id: result.id };
  }
  const result = commit(createMatchSubmission(readStore(), parsed.data, new Date()));
  if (!result.ok) return failure(result.errors);
  await track("submission_completed", { entity: "match" });
  revalidatePath("/admin/submissions");
  return { ok: true as const, id: result.result.id };
}

export async function submitAcademyAction(_state: unknown, formData: FormData) {
  const parsed = academySubmissionSchema.safeParse(readForm(formData));
  if (!parsed.success) return failure(zodErrors(parsed.error));
  if (honeypot(parsed.data.companyWebsite)) return { ok: true as const, id: "ignored" };
  const limited = await gate(
    `academy:${parsed.data.contactEmail}`,
    8,
    60 * 60 * 1000,
    "Too many submissions. Try again in an hour.",
  );
  if (limited) return limited;
  const blocked = requireWritable();
  if (blocked) return blocked;
  if (dataMode() === "supabase") {
    const session = await getSession();
    const result = await serviceCreateSubmission({
      entityType: "academy",
      submitterId: session?.userId ?? null,
      payload: withoutHoneypot(parsed.data),
    });
    if (!result.ok) return result;
    await track("submission_completed", { entity: "academy" });
    revalidatePath("/admin/submissions");
    return { ok: true as const, id: result.id };
  }
  const result = commit(createAcademySubmission(readStore(), parsed.data, new Date()));
  if (!result.ok) return failure(result.errors);
  await track("submission_completed", { entity: "academy" });
  revalidatePath("/admin/submissions");
  return { ok: true as const, id: result.result.id };
}

export async function submitCorrectionAction(_state: unknown, formData: FormData) {
  const parsed = correctionSchema.safeParse(readForm(formData));
  if (!parsed.success) return failure(zodErrors(parsed.error));
  if (honeypot(parsed.data.companyWebsite)) return { ok: true as const, id: "ignored" };
  const limited = await gate(
    "correction",
    10,
    60 * 60 * 1000,
    "Too many reports. Try again later.",
  );
  if (limited) return limited;
  const blocked = requireWritable();
  if (blocked) return blocked;
  if (dataMode() === "supabase") {
    const session = await getSession();
    const result = await serviceCreateSubmission({
      entityType: "correction",
      submitterId: session?.userId ?? null,
      payload: {
        matchSlug: parsed.data.matchSlug,
        details: parsed.data.details,
        email: parsed.data.email || "",
      },
    });
    if (!result.ok) return result;
    await track("correction_submitted", { match: parsed.data.matchSlug });
    revalidatePath("/admin/corrections");
    return { ok: true as const, id: result.id };
  }
  const result = commit(
    createCorrection(
      readStore(),
      {
        matchSlug: parsed.data.matchSlug,
        email: parsed.data.email || undefined,
        details: parsed.data.details,
      },
      new Date(),
    ),
  );
  if (!result.ok) return failure(result.errors);
  await track("correction_submitted", { match: parsed.data.matchSlug });
  revalidatePath("/admin/corrections");
  return { ok: true as const, id: result.result.id };
}

export async function requestTicketAction(_state: unknown, formData: FormData) {
  const parsed = ticketRequestSchema.safeParse(readForm(formData));
  if (!parsed.success) return failure(zodErrors(parsed.error));
  if (honeypot(parsed.data.companyWebsite)) return { ok: true as const, already: false };
  const limited = await gate(
    `ticket:${parsed.data.email}`,
    6,
    60 * 60 * 1000,
    "Too many alert requests. Try again later.",
  );
  if (limited) return limited;
  const blocked = requireWritable();
  if (blocked) return blocked;
  const verify = newToken();
  const unsub = newToken();
  if (dataMode() === "supabase") {
    const session = await getSession();
    const result = await serviceCreateTicketRequest({
      matchSlug: parsed.data.matchSlug,
      emailHash: hashEmail(parsed.data.email),
      encryptedEmail: encryptString(parsed.data.email),
      quantity: parsed.data.quantity,
      countryCode: parsed.data.countryCode,
      notes: parsed.data.notes || "",
      verifyTokenHash: hashToken(verify),
      unsubTokenHash: hashToken(unsub),
      userId: session?.userId ?? null,
    });
    if (!result.ok) return result;
    if (!result.already) {
      await sendAlertConfirmation(parsed.data.email, verify, unsub);
      await track("ticket_request_started", { match: parsed.data.matchSlug });
    }
    return { ok: true as const, already: result.already };
  }
  const result = commit(
    createTicketRequest(
      readStore(),
      {
        ...parsed.data,
        emailHash: hashEmail(parsed.data.email),
        encryptedEmail: encryptString(parsed.data.email),
        verifyTokenHash: hashToken(verify),
        unsubTokenHash: hashToken(unsub),
      },
      new Date(),
    ),
  );
  if (!result.ok) return failure(result.errors);
  if (!result.result.already) {
    await sendAlertConfirmation(parsed.data.email, verify, unsub);
    await track("ticket_request_started", { match: parsed.data.matchSlug });
  }
  if (demoRolesAllowed() && !result.result.already) {
    return { ok: true as const, already: false, demoVerify: verify, demoUnsubscribe: unsub };
  }
  return { ok: true as const, already: result.result.already };
}

async function sendAlertConfirmation(email: string, verify: string, unsub: string) {
  const verifyLink = `${siteUrl()}/requests/${verify}`;
  const unsubLink = `${siteUrl()}/requests/${unsub}?intent=unsubscribe`;
  await emailService().send({
    to: email,
    subject: "Confirm your cricket ticket alert",
    text: `Confirm this alert: ${verifyLink}\nA request does not reserve a ticket.\nUnsubscribe: ${unsubLink}`,
  });
}

export async function openRequestTokenAction(_state: unknown, formData: FormData) {
  const blocked = requireWritable();
  if (blocked) return blocked;
  const hashed = hashToken(String(formData.get("token") || ""));
  const unsubscribe = formData.get("intent") === "unsubscribe";
  if (dataMode() === "supabase") {
    const result = await serviceOpenTicketRequest(hashed, unsubscribe ? "unsubscribe" : "verify");
    if (!result.ok) return result;
    if (result.intent === "unsubscribe") await track("ticket_request_unsubscribed");
    else await track("ticket_request_verified");
    return result;
  }
  const now = new Date();
  const result = unsubscribe
    ? commit(unsubscribeTicketRequest(readStore(), hashed, now))
    : commit(verifyTicketRequest(readStore(), hashed, now));
  if (result.ok && unsubscribe) await track("ticket_request_unsubscribed");
  if (result.ok && !unsubscribe) await track("ticket_request_verified");
  return result.ok
    ? {
        ok: true as const,
        matchSlug: result.result.matchSlug,
        intent: unsubscribe ? ("unsubscribe" as const) : ("verify" as const),
      }
    : failure(result.errors);
}

export async function reviewSubmissionAction(_state: unknown, formData: FormData) {
  const session = await getSession();
  if (!session || !isStaff(session.role)) return failure({ form: "Moderator access is required." });
  const blocked = requireWritable();
  if (blocked) return blocked;
  const parsed = reviewSchema.safeParse(readForm(formData));
  if (!parsed.success) return failure(zodErrors(parsed.error));
  if (dataMode() === "supabase") {
    const result = await serviceReview({
      id: parsed.data.id,
      action: parsed.data.action,
      reason: parsed.data.reason,
      mergeTarget: parsed.data.mergeTarget,
      actorId: session.userId,
    });
    revalidatePath("/");
    revalidatePath("/matches");
    revalidatePath("/admin");
    return result;
  }
  const result = commit(
    reviewSubmission(
      readStore(),
      {
        id: parsed.data.id,
        action: parsed.data.action,
        reason: parsed.data.reason,
        mergeTarget: parsed.data.mergeTarget,
        actorEmail: session.email,
      },
      new Date(),
    ),
  );
  revalidatePath("/");
  revalidatePath("/matches");
  revalidatePath("/admin");
  if (!result.ok) return failure(result.errors);
  return { ok: true as const };
}

export async function approveOfferAction(_state: unknown, formData: FormData) {
  const session = await getSession();
  if (!session || !isStaff(session.role)) return failure({ form: "Moderator access is required." });
  const blocked = requireWritable();
  if (blocked) return blocked;
  const matchSlug = String(formData.get("matchSlug") || "");
  const offerId = String(formData.get("offerId") || "");
  if (dataMode() === "supabase") {
    const result = await serviceApproveOffer({ offerId, matchSlug, actorId: session.userId });
    if (!result.ok) return result;
    await deliver(result.emails);
    revalidatePath(`/match/${matchSlug}`);
    revalidatePath("/admin/ticket-links");
    return { ok: true as const, notified: result.notified };
  }
  const result = commit(
    approveOffer(readStore(), { matchSlug, offerId, actorEmail: session.email }, new Date()),
  );
  if (!result.ok) return failure(result.errors);
  await deliver(result.emails);
  revalidatePath(`/match/${matchSlug}`);
  revalidatePath("/admin/ticket-links");
  return { ok: true as const, notified: result.result.notified };
}

export async function markVerifiedAction(_state: unknown, formData: FormData) {
  const session = await getSession();
  if (!session || !isStaff(session.role)) return failure({ form: "Moderator access is required." });
  const blocked = requireWritable();
  if (blocked) return blocked;
  const matchSlug = String(formData.get("matchSlug") || "");
  if (dataMode() === "supabase") {
    const result = await serviceMarkVerified({ matchSlug, actorId: session.userId });
    if (!result.ok) return result;
    revalidatePath(`/match/${matchSlug}`);
    return { ok: true as const };
  }
  const result = commit(
    markVerified(readStore(), { matchSlug, actorEmail: session.email }, new Date()),
  );
  if (!result.ok) return failure(result.errors);
  revalidatePath(`/match/${matchSlug}`);
  return { ok: true as const };
}

export async function setUserRoleAction(_state: unknown, formData: FormData) {
  const session = await getSession();
  if (!session || session.role !== "admin") return failure({ form: "Admin access is required." });
  const blocked = requireWritable();
  if (blocked) return blocked;
  const account = String(formData.get("account") || "").trim();
  const role = String(formData.get("role") || "");
  if (!ROLES.includes(role as Role)) return failure({ form: "Choose a role." });
  if (account.length < 3) return failure({ form: "Enter the account email or user id." });
  if (dataMode() === "supabase") {
    const result = await serviceAssignRole({
      account,
      role: role as Role,
      actorId: session.userId,
    });
    revalidatePath("/admin");
    return result;
  }
  const result = commit(
    assignRole(
      readStore(),
      { actorEmail: session.email, actorRole: session.role, account, role: role as Role },
      new Date(),
    ),
  );
  revalidatePath("/admin");
  if (!result.ok) return failure(result.errors);
  return { ok: true as const };
}
