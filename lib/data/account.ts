import "server-only";
import type { Session } from "@/lib/auth/session";
import { supabaseServer } from "@/lib/auth/supabase-server";
import { dataMode } from "@/lib/data/mode";
import { readStore } from "@/lib/data/store";
import type { Submission } from "@/lib/domain/types";
import { mergeAcademies } from "@/lib/domain/workflows";
import { hashEmail } from "@/lib/security/crypto";

export type AccountAcademy = {
  slug: string;
  name: string;
  verificationStatus: string;
  verificationLabel: string | null;
};

export type AccountSnapshot = {
  submissions: Submission[];
  alertCount: number;
  academies: AccountAcademy[];
};

function mapSubmission(row: {
  id: string;
  entity_type: Submission["entityType"];
  payload: Record<string, unknown> | null;
  submitter_email: string | null;
  status: Submission["status"];
  duplicate_of: string | null;
  reviewer_email: string | null;
  reviewer_notes: string | null;
  created_at: string;
  updated_at: string;
}): Submission {
  return {
    id: row.id,
    entityType: row.entity_type,
    payload: row.payload ?? {},
    submitterEmail: row.submitter_email,
    status: row.status,
    duplicateOf: row.duplicate_of,
    reviewerEmail: row.reviewer_email,
    reviewerNotes: row.reviewer_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function accountSnapshot(session: Session): Promise<AccountSnapshot> {
  if (dataMode() !== "supabase") {
    const store = readStore();
    const email = session.email.toLowerCase();
    const digest = hashEmail(email);
    return {
      submissions: store.submissions.filter((item) => item.submitterEmail === email),
      alertCount: store.requests.filter((item) => item.emailHash === digest).length,
      academies: mergeAcademies(store)
        .filter((academy) => academy.ownerEmail === email)
        .map((academy) => ({
          slug: academy.slug,
          name: academy.name,
          verificationStatus: academy.verificationStatus,
          verificationLabel: academy.verificationLabel,
        })),
    };
  }

  const supabase = await supabaseServer();
  if (!supabase) return { submissions: [], alertCount: 0, academies: [] };
  const email = session.email.toLowerCase();
  const [byUser, byEmail, alerts, owned, contacted] = await Promise.all([
    supabase.from("moderation_submissions").select("*").eq("submitter_id", session.userId),
    supabase.from("moderation_submissions").select("*").eq("submitter_email", email),
    supabase.from("ticket_requests").select("id", { count: "exact", head: true }).eq("user_id", session.userId),
    supabase.from("academies").select("slug, name, verification_status, verification_label").eq("owner_id", session.userId),
    supabase.from("academies").select("slug, name, verification_status, verification_label").eq("contact_email", email),
  ]);
  const failed = byUser.error || byEmail.error || alerts.error || owned.error || contacted.error;
  if (failed) throw new Error(failed.message);
  const seen = new Set<string>();
  const submissions = [...(byUser.data ?? []), ...(byEmail.data ?? [])]
    .filter((row) => (seen.has(row.id) ? false : Boolean(seen.add(row.id))))
    .map((row) => mapSubmission(row));
  const academySeen = new Set<string>();
  const academies = [...(owned.data ?? []), ...(contacted.data ?? [])]
    .filter((row) => (academySeen.has(row.slug) ? false : Boolean(academySeen.add(row.slug))))
    .map((row) => ({
      slug: row.slug,
      name: row.name,
      verificationStatus: row.verification_status,
      verificationLabel: row.verification_label,
    }));
  return { submissions, alertCount: alerts.count ?? 0, academies };
}
