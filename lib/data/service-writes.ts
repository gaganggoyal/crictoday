import "server-only";
import type { EmailDraft } from "@/lib/domain/workflows";
import type { Role } from "@/lib/domain/types";
import { supabaseService } from "@/lib/data/supabase";

type Failure = { ok: false; errors: Record<string, string> };

function failure(errors: Record<string, string>): Failure {
  return { ok: false, errors };
}

function asJson<T>(data: unknown): T {
  if (typeof data === "string") return JSON.parse(data) as T;
  return data as T;
}

function rpcFailure(error: { message: string; code?: string } | null): Failure | null {
  if (!error) return null;
  const message = error.code === "P0001" ? error.message : "The database rejected this action.";
  if (message === "A reason is required.") return failure({ reason: message });
  if (message.includes("canonical match")) return failure({ mergeTarget: message });
  return failure({ form: message });
}

function service() {
  const client = supabaseService();
  if (!client)
    return {
      client: null,
      error: failure({
        form: "The server is missing SUPABASE_SECRET_KEY, so this action cannot be saved.",
      }),
    };
  return { client, error: null };
}

export async function serviceCreateSubmission(input: {
  entityType: "match" | "academy" | "ticket_offer" | "correction";
  payload: Record<string, unknown>;
  submitterId: string | null;
}) {
  const { client, error } = service();
  if (!client) return error;
  const { data, error: rpcError } = await client.rpc("create_submission", {
    p_entity_type: input.entityType,
    p_payload: input.payload,
    p_submitter_id: input.submitterId,
  });
  const failed = rpcFailure(rpcError);
  if (failed) return failed;
  return { ok: true as const, id: String(data) };
}

export async function serviceReview(input: {
  id: string;
  action: "approve" | "reject" | "changes" | "merge";
  reason?: string;
  mergeTarget?: string;
  actorId: string;
}) {
  const { client, error } = service();
  if (!client) return error;
  const { error: rpcError } = await client.rpc("review_submission", {
    p_id: input.id,
    p_action: input.action,
    p_reason: input.reason ?? "",
    p_merge_target: input.mergeTarget ?? "",
    p_actor: input.actorId,
  });
  const failed = rpcFailure(rpcError);
  if (failed) return failed;
  return { ok: true as const };
}

export async function serviceAssignRole(input: { account: string; role: Role; actorId: string }) {
  const { client, error } = service();
  if (!client) return error;
  const { error: rpcError } = await client.rpc("set_user_role_for_account", {
    p_account: input.account,
    p_role: input.role,
    p_actor: input.actorId,
  });
  const failed = rpcFailure(rpcError);
  if (failed) return failed;
  return { ok: true as const };
}

export async function serviceCreateTicketRequest(input: {
  matchSlug: string;
  emailHash: string;
  encryptedEmail: string;
  quantity: number;
  countryCode: string;
  notes: string;
  verifyTokenHash: string;
  unsubTokenHash: string;
  userId: string | null;
}) {
  const { client, error } = service();
  if (!client) return error;
  const { data, error: rpcError } = await client.rpc("create_ticket_request", {
    p_match_slug: input.matchSlug,
    p_email_hash: input.emailHash,
    p_encrypted_email: input.encryptedEmail,
    p_quantity: input.quantity,
    p_country_code: input.countryCode,
    p_notes: input.notes,
    p_verify_hash: input.verifyTokenHash,
    p_unsub_hash: input.unsubTokenHash,
    p_user_id: input.userId,
  });
  const failed = rpcFailure(rpcError);
  if (failed) return failed;
  const body = asJson<{ id: string; already: boolean }>(data);
  return { ok: true as const, id: body.id, already: Boolean(body.already) };
}

export async function serviceOpenTicketRequest(
  tokenHash: string,
  intent: "verify" | "unsubscribe",
) {
  const { client, error } = service();
  if (!client) return error;
  const { data, error: rpcError } = await client.rpc("open_ticket_request", {
    p_token_hash: tokenHash,
    p_intent: intent,
  });
  const failed = rpcFailure(rpcError);
  if (failed) return failed;
  const body = asJson<{ match_slug: string; intent: string }>(data);
  return {
    ok: true as const,
    matchSlug: body.match_slug,
    intent: body.intent === "unsubscribe" ? ("unsubscribe" as const) : ("verify" as const),
  };
}

export async function serviceApproveOffer(input: {
  offerId: string;
  matchSlug: string;
  actorId: string;
}) {
  const { client, error } = service();
  if (!client) return error;
  const { data, error: rpcError } = await client.rpc("approve_ticket_offer", {
    p_offer_id: input.offerId,
    p_match_slug: input.matchSlug,
    p_actor: input.actorId,
  });
  const failed = rpcFailure(rpcError);
  if (failed) return failed;
  const body = asJson<{ notified: number; emails: EmailDraft[] }>(data);
  return { ok: true as const, notified: body.notified ?? 0, emails: body.emails ?? [] };
}

export async function serviceMarkVerified(input: { matchSlug: string; actorId: string }) {
  const { client, error } = service();
  if (!client) return error;
  const { error: rpcError } = await client.rpc("mark_match_verified", {
    p_slug: input.matchSlug,
    p_actor: input.actorId,
  });
  const failed = rpcFailure(rpcError);
  if (failed) return failed;
  return { ok: true as const };
}

export async function serviceRecordClick(offerId: string, referrer: string | null) {
  const { client, error } = service();
  if (!client) return error;
  const { error: rpcError } = await client.rpc("record_outbound_click", {
    p_offer_id: offerId,
    p_referrer: referrer,
  });
  const failed = rpcFailure(rpcError);
  if (failed) return failed;
  return { ok: true as const };
}
