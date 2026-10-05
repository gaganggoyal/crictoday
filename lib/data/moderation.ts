import "server-only";
import { getSession, isStaff, type Session } from "@/lib/auth/session";
import { supabaseServer } from "@/lib/auth/supabase-server";
import { getDirectory } from "@/lib/data/catalog";
import { dataMode } from "@/lib/data/mode";
import { mysqlPool } from "@/lib/data/mysql/pool";
import { loadModeration } from "@/lib/data/mysql/reads";
import { readStore } from "@/lib/data/store";
import type {
  AuditRecord,
  ImportRun,
  StoredMatch,
  StoredOffer,
  Submission,
  TicketKind,
  TicketOfferStatus,
} from "@/lib/domain/types";
import { mergeMatches } from "@/lib/domain/workflows";

export type OfferQueueItem = {
  matchSlug: string;
  homeName: string;
  awayName: string;
  homeShort: string;
  awayShort: string;
  offer: StoredOffer;
};

export type ModerationSnapshot = {
  session: Session | null;
  submissions: Submission[];
  offers: OfferQueueItem[];
  audit: AuditRecord[];
  importRuns: ImportRun[];
  deadLetters: Array<{ id: string; provider: string; reason: string }>;
  matches: StoredMatch[];
};

const empty = (session: Session | null): ModerationSnapshot => ({
  session,
  submissions: [],
  offers: [],
  audit: [],
  importRuns: [],
  deadLetters: [],
  matches: [],
});

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

export async function moderationSnapshot(): Promise<ModerationSnapshot> {
  const session = await getSession();
  if (!session || !isStaff(session.role)) return empty(session);
  if (dataMode() === "mysql") {
    const [queue, directory] = await Promise.all([loadModeration(mysqlPool()), getDirectory()]);
    return { session, ...queue, matches: directory.matches };
  }
  if (dataMode() !== "supabase") {
    const store = readStore();
    const matches = mergeMatches(store);
    return {
      session,
      submissions: store.submissions,
      offers: matches.flatMap((match) =>
        match.offers.map((offer) => ({
          matchSlug: match.slug,
          homeName: match.homeName,
          awayName: match.awayName,
          homeShort: match.homeShort,
          awayShort: match.awayShort,
          offer,
        })),
      ),
      audit: store.audit,
      importRuns: store.importRuns,
      deadLetters: store.deadLetters,
      matches,
    };
  }

  const supabase = await supabaseServer();
  if (!supabase) return empty(session);
  const [submissions, offers, audit, imports, letters, directory] = await Promise.all([
    supabase.from("moderation_submissions").select("*").order("created_at", { ascending: false }),
    supabase.from("moderation_offers").select("*").order("match_slug"),
    supabase
      .from("moderation_audit")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("import_runs").select("*").order("started_at", { ascending: false }).limit(50),
    supabase
      .from("dead_letters")
      .select("id, provider, reason")
      .order("created_at", { ascending: false })
      .limit(100),
    getDirectory(),
  ]);
  const failed = submissions.error || offers.error || audit.error || imports.error || letters.error;
  if (failed) throw new Error(failed.message);

  return {
    session,
    submissions: (submissions.data ?? []).map((row) => mapSubmission(row)),
    offers: (offers.data ?? []).map((row) => ({
      matchSlug: row.match_slug,
      homeName: row.home_name,
      awayName: row.away_name,
      homeShort: row.home_short,
      awayShort: row.away_short,
      offer: {
        id: row.id,
        sellerName: row.seller_name,
        sellerDomain: row.seller_domain,
        url: row.url,
        kind: row.kind as TicketKind,
        currency: row.currency,
        priceFrom: row.price_from == null ? null : Number(row.price_from),
        status: row.status as TicketOfferStatus,
        lastCheckedAt: row.last_checked_at,
        approved: Boolean(row.approved),
      },
    })),
    audit: (audit.data ?? []).map((row) => ({
      id: row.id,
      actorEmail: row.actor_email,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id ?? "",
      before: row.before,
      after: row.after,
      createdAt: row.created_at,
    })),
    importRuns: (imports.data ?? []).map((row) => ({
      id: row.id,
      provider: row.provider,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      fetchedCount: row.fetched_count,
      insertedCount: row.inserted_count,
      updatedCount: row.updated_count,
      failedCount: row.failed_count,
      status: row.status,
      errorSummary: row.error_summary,
    })),
    deadLetters: letters.data ?? [],
    matches: directory.matches,
  };
}
