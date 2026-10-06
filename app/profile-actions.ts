"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession, isStaff } from "@/lib/auth/session";
import { dataMode } from "@/lib/data/mode";
import { mysqlPool } from "@/lib/data/mysql/pool";
import {
  createProfile,
  removeOffering,
  reviewProfile,
  saveOffering,
  saveOwnerMatch,
  updateProfile,
  type Owner,
} from "@/lib/data/mysql/profiles";
import { sendDrafts } from "@/lib/email/send";
import { limitHit } from "@/lib/security/limit";
import { offeringSchema, ownerMatchSchema, profileSchema } from "@/lib/validation/profile";
import { zodErrors } from "@/lib/validation/schemas";

type Failure = { ok: false; errors: Record<string, string> };

const failure = (errors: Record<string, string>): Failure => ({ ok: false, errors });

const OWNER_REASON = "You are getting this email because of a profile on cricketmatch.today.";
const LISTS = new Set(["ageGroups", "facilities"]);

function readForm(formData: FormData) {
  const raw: Record<string, unknown> = {};
  for (const key of new Set(formData.keys())) {
    const values = formData
      .getAll(key)
      .filter((value): value is string => typeof value === "string");
    raw[key] = LISTS.has(key) ? values : values[0];
  }
  for (const key of LISTS) raw[key] ??= [];
  return raw;
}

/** The signed-in owner, or the reason the profile tools are closed. */
async function owner(): Promise<Owner | Failure> {
  const session = await getSession();
  if (!session) return failure({ form: "Sign in to manage your profile." });
  if (dataMode() !== "mysql") {
    return failure({ form: "Profiles need the site's database, which this preview does not run." });
  }
  return { userId: session.userId, email: session.email };
}

async function gate(key: string, limit: number, windowMs: number) {
  const result = await limitHit(key, limit, windowMs);
  if (result.unavailable)
    return failure({ form: "This is paused for a moment. Try again shortly." });
  if (!result.ok)
    return failure({ form: "That is a lot of changes at once. Try again in an hour." });
  return null;
}

function refresh(slug?: string) {
  revalidatePath("/dashboard", "layout");
  revalidatePath("/academies");
  if (slug) {
    revalidatePath(`/academy/${slug}`);
    revalidatePath(`/club/${slug}`);
  }
}

export async function createProfileAction(_state: unknown, formData: FormData) {
  const who = await owner();
  if ("ok" in who) return who;
  const raw = readForm(formData);
  if (typeof raw.companyWebsite === "string" && raw.companyWebsite.trim()) {
    return failure({ form: "This form could not be sent." });
  }
  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success) return failure(zodErrors(parsed.error));
  const blocked = await gate(`profile-create:${who.userId}`, 5, 60 * 60 * 1000);
  if (blocked) return blocked;
  const result = await createProfile(mysqlPool(), who, parsed.data, new Date());
  if (!result.ok) return result;
  await sendDrafts(
    result.emails,
    "You are getting this email because you moderate cricketmatch.today.",
  );
  refresh(result.slug);
  redirect(`/dashboard/profiles/${result.slug}?created=1`);
}

export async function updateProfileAction(_state: unknown, formData: FormData) {
  const who = await owner();
  if ("ok" in who) return who;
  const raw = readForm(formData);
  const slug = typeof raw.slug === "string" ? raw.slug : "";
  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success) return failure(zodErrors(parsed.error));
  const blocked = await gate(`profile-edit:${who.userId}`, 60, 60 * 60 * 1000);
  if (blocked) return blocked;
  const result = await updateProfile(mysqlPool(), who, slug, parsed.data, new Date());
  if (!result.ok) return result;
  await sendDrafts(
    result.emails,
    "You are getting this email because you moderate cricketmatch.today.",
  );
  refresh(slug);
  return { ok: true as const, status: result.status };
}

export async function saveOfferingAction(_state: unknown, formData: FormData) {
  const who = await owner();
  if ("ok" in who) return who;
  const parsed = offeringSchema.safeParse(readForm(formData));
  if (!parsed.success) return failure(zodErrors(parsed.error));
  const blocked = await gate(`offering:${who.userId}`, 120, 60 * 60 * 1000);
  if (blocked) return blocked;
  const result = await saveOffering(mysqlPool(), who, parsed.data, new Date());
  if (!result.ok) return result;
  refresh(parsed.data.profile);
  return { ok: true as const, id: result.id };
}

export async function removeOfferingAction(formData: FormData) {
  const who = await owner();
  if ("ok" in who) return;
  const profile = String(formData.get("profile") || "");
  const id = String(formData.get("id") || "");
  await removeOffering(mysqlPool(), who, { profile, id }, new Date());
  refresh(profile);
}

export async function saveMatchAction(_state: unknown, formData: FormData) {
  const who = await owner();
  if ("ok" in who) return who;
  const raw = readForm(formData);
  const parsed = ownerMatchSchema.safeParse(raw);
  if (!parsed.success) return failure(zodErrors(parsed.error));
  const blocked = await gate(`match-post:${who.userId}`, 120, 60 * 60 * 1000);
  if (blocked) return blocked;
  const result = await saveOwnerMatch(mysqlPool(), who, parsed.data, new Date());
  if (!result.ok) return result;
  refresh(parsed.data.profile);
  revalidatePath(`/match/${result.slug}`);
  if (raw.again === "1") {
    const posted = parsed.data;
    // The next match of a schedule usually shares the tournament, ground, town and format.
    const next = {
      match: "",
      competition: posted.competition ?? "",
      homeTeam: posted.homeTeam,
      awayTeam: "",
      date: posted.date,
      time: posted.time,
      ground: posted.ground,
      state: posted.state ?? "",
      city: posted.city,
      format: posted.format,
      attendance: posted.attendance,
      entryNotes: posted.entryNotes ?? "",
      ticketUrl: "",
      status: "published",
    };
    return { ok: true as const, slug: result.slug, status: result.status, again: true, next };
  }
  redirect(`/dashboard/profiles/${parsed.data.profile}?saved=${result.slug}`);
}

export async function reviewProfileAction(_state: unknown, formData: FormData) {
  const session = await getSession();
  if (!session || !isStaff(session.role)) return failure({ form: "Moderator access is required." });
  if (dataMode() !== "mysql") return failure({ form: "Profiles need the site's database." });
  const slug = String(formData.get("slug") || "");
  const action = formData.get("action") === "reject" ? "reject" : "approve";
  const reason = String(formData.get("reason") || "");
  const result = await reviewProfile(
    mysqlPool(),
    { actorId: session.userId, slug, action, reason },
    new Date(),
  );
  if (!result.ok) return result;
  await sendDrafts(result.emails, OWNER_REASON);
  refresh(slug);
  revalidatePath("/admin/profiles");
  return { ok: true as const, action };
}
